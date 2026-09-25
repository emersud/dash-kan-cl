-- =============================================================================
-- EDUPROJECT AGILE — MIGRACAO 0009: EXCLUSAO EM CASCATA COMPLETA DO USUARIO
-- -----------------------------------------------------------------------------
-- Objetivo: quando um professor/gestor exclui um aluno (ou o gestor exclui um
-- professor), TODA a informacao ligada ao usuario desaparece da base:
--   * public.usuarios e todas as tabelas filhas;
--   * auth.identities (antes podia sobrar quando a exclusao passava pelo
--     caminho sem RPC);
--   * auth.users (sessions, refresh_tokens, mfa etc. vao na cascata);
--   * public.historico_acoes (auditoria sem FK — guarda id/email nos jsonb).
--
-- Inclui tambem a LIMPEZA dos orfãos ja existentes: identidades/contas de login
-- cujo usuario nao esta mais em public.usuarios.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) EXCLUSAO COMPLETA DE UM USUARIO (versao definitiva)
-- -----------------------------------------------------------------------------
create or replace function public.excluir_usuario_completo(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_alvo_papel public.user_papel;
begin
  if not public.is_professor() then
    raise exception 'Acesso negado: apenas professor/gestor pode excluir usuarios.';
  end if;

  if p_usuario_id is null then
    raise exception 'Informe o usuario a ser excluido.';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'Voce nao pode excluir o proprio usuario logado.';
  end if;

  -- REGRA: professor so exclui alunos (migração 0008).
  select papel into v_alvo_papel from public.usuarios where id = p_usuario_id;
  if public.usuario_papel() <> 'gestor' and v_alvo_papel is distinct from 'aluno' then
    raise exception 'Professores so podem excluir alunos. Gestores e professores so podem ser excluidos pelo gestor.';
  end if;

  -- 1) Tarefas alocadas (checklists caem em cascade)
  delete from public.tarefas where aluno_id = p_usuario_id;

  -- 2) Daily registers do usuario
  delete from public.daily_registers where aluno_id = p_usuario_id;

  -- 3) Historico de atividades
  delete from public.historico_atividades where usuario_id = p_usuario_id;

  -- 4) Vinculo com equipes
  delete from public.equipe_membros where aluno_id = p_usuario_id;

  -- 5) auth.identities (explicito, antes do auth.users)
  begin
    delete from auth.identities where user_id = p_usuario_id;
  exception when others then
    raise notice 'auth.identities nao limpo (%): %', p_usuario_id, sqlerrm;
  end;

  -- 6) Conta de login (cascata: sessions, refresh_tokens, mfa, identities...)
  delete from auth.users where id = p_usuario_id;

  -- 7) Perfil orfao (quando nao havia linha em auth.users)
  delete from public.usuarios where id = p_usuario_id;

  -- 8) Auditoria: acoes do usuario, registros dele e jsonb que citam o id
  --    (feito por ultimo tambem limpa os registros gerados por esta exclusao)
  delete from public.historico_acoes h
   where h.usuario_id = p_usuario_id
      or h.registro_id = p_usuario_id
      or h.dados_anteriores::text like '%' || p_usuario_id::text || '%'
      or h.dados_novos::text    like '%' || p_usuario_id::text || '%';

  -- 9) Melhor esforço: eventos de autenticacao que citam o usuario
  begin
    if to_regclass('auth.audit_log_entries') is not null then
      delete from auth.audit_log_entries
       where payload::text like '%' || p_usuario_id::text || '%';
    end if;
  exception when others then
    raise notice 'auth.audit_log_entries nao limpo (%): %', p_usuario_id, sqlerrm;
  end;
end;
$$;

revoke all on function public.excluir_usuario_completo(uuid) from public;
revoke all on function public.excluir_usuario_completo(uuid) from anon;
grant execute on function public.excluir_usuario_completo(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) LIMPEZA DE CONTAS ORFÃS (usuario sem linha em public.usuarios)
-- -----------------------------------------------------------------------------
-- public.limpar_auth_orfao([usuario]) remove auth.identities + auth.users
-- (e a auditoria do app associada) de quem ja nao existe na tabela usuarios.
--   * sem parametro  -> varre TODAS as contas orfas (apenas gestor);
--   * com parametro   -> limpa apenas esse id (professor/gestor).
-- Retorna { identidades, contas, auditoria }.
create or replace function public.limpar_auth_orfao(p_usuario_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_ids         uuid[] := array[]::uuid[];
  v_id          uuid;
  v_identidades integer := 0;
  v_contas      integer := 0;
  v_auditoria   integer := 0;
  v_qtd         integer;
begin
  -- Sessao do app: so professor/gestor. Direto no SQL Editor (postgres, sem
  -- auth.uid()) a limpeza tambem pode ser executada.
  if auth.uid() is not null and not public.is_professor() then
    raise exception 'Acesso negado: apenas professor/gestor pode limpar contas orfas.';
  end if;

  if p_usuario_id is null then
    if auth.uid() is not null and public.usuario_papel() <> 'gestor' then
      raise exception 'A limpeza geral de contas orfas e exclusiva do gestor.';
    end if;
    select coalesce(array_agg(distinct x.id), array[]::uuid[])
      into v_ids
      from (
        select us.id
          from auth.users us
         where not exists (select 1 from public.usuarios u where u.id = us.id)
        union
        select i.user_id
          from auth.identities i
         where not exists (select 1 from public.usuarios u where u.id = i.user_id)
      ) x;
  else
    v_ids := array[p_usuario_id];
  end if;

  foreach v_id in array v_ids loop
    -- auditoria do app (sem FK): guarda id nos jsonb
    delete from public.historico_acoes h
     where h.usuario_id = v_id
        or h.registro_id = v_id
        or h.dados_anteriores::text like '%' || v_id::text || '%'
        or h.dados_novos::text       like '%' || v_id::text || '%';
    get diagnostics v_qtd = row_count;
    v_auditoria := v_auditoria + v_qtd;

    -- identidades de login
    begin
      delete from auth.identities where user_id = v_id;
      get diagnostics v_qtd = row_count;
      v_identidades := v_identidades + v_qtd;
    exception when others then
      raise notice 'auth.identities nao limpo (%): %', v_id, sqlerrm;
    end;

    -- conta de login inteira (sessions/refresh_tokens/mfa vao junto)
    delete from auth.users where id = v_id;
    get diagnostics v_qtd = row_count;
    v_contas := v_contas + v_qtd;
  end loop;

  return jsonb_build_object(
    'ids',        cardinality(v_ids),
    'identidades', v_identidades,
    'contas',      v_contas,
    'auditoria',   v_auditoria
  );
end;
$$;

revoke all on function public.limpar_auth_orfao(uuid) from public;
revoke all on function public.limpar_auth_orfao(uuid) from anon;
grant execute on function public.limpar_auth_orfao(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) LIMPEZA UNICA DOS ORFÃOS JA EXISTENTES (roda nesta migracao)
-- -----------------------------------------------------------------------------
-- Tudo dentro de UM unico bloco DO (sem tabela temporaria, que nem sempre
-- fica visivel entre statements no SQL Editor).
-- Guarda os ids antes: apagar auth.users primeiro deixaria as identidades
-- orfas sem referencia (foi exatamente o que aconteceu nas exclusoes antigas).
-- Segurança: se public.usuarios estiver vazia, a varredura NÃO roda (evita
-- apagar todas as contas de login do sistema por engano).
do $$
declare
  v_ids         uuid[];
  v_identidades integer := 0;
  v_contas      integer := 0;
  v_auditoria   integer := 0;
  v_qtd         integer;
begin
  if (select count(*) from public.usuarios) = 0 then
    raise notice 'public.usuarios vazia: limpeza de contas orfas IGNORADA (evitaria apagar todas as contas de login).';
    return;
  end if;

  -- contas de login/identidades que ja nao tem perfil em public.usuarios
  select coalesce(array_agg(distinct x.id), array[]::uuid[])
    into v_ids
    from (
      select us.id
        from auth.users us
       where not exists (select 1 from public.usuarios u where u.id = us.id)
      union
      select i.user_id
        from auth.identities i
       where not exists (select 1 from public.usuarios u where u.id = i.user_id)
    ) x;

  if cardinality(v_ids) = 0 then
    raise notice 'Nenhuma conta orfa encontrada: auth.users/auth.identities e public.usuarios estao consistentes.';
    return;
  end if;

  -- 3.1 Auditoria do app (id nos jsonb dados_anteriores/dados_novos)
  delete from public.historico_acoes h
   where exists (
           select 1 from unnest(v_ids) t(id)
            where h.usuario_id = t.id
               or h.registro_id = t.id
               or h.dados_anteriores::text like '%' || t.id::text || '%'
               or h.dados_novos::text       like '%' || t.id::text || '%'
         );
  get diagnostics v_qtd = row_count;
  v_auditoria := v_auditoria + v_qtd;

  -- 3.2 Identidades de login que ficaram sem usuario
  begin
    delete from auth.identities i where i.user_id = any (v_ids);
    get diagnostics v_qtd = row_count;
    v_identidades := v_qtd;
  exception when others then
    raise notice 'auth.identities nao limpo direto: % — a cascata de auth.users deve resolve-lo.', sqlerrm;
  end;

  -- 3.3 Contas de login orfas (sessions/refresh_tokens/mfa vao junto)
  --     Envolvido em exception para nao derrubar a migracao inteira caso o
  --     papel de execucao nao tenha permissao de DELETE em auth.users.
  begin
    delete from auth.users us where us.id = any (v_ids);
    get diagnostics v_qtd = row_count;
    v_contas := v_qtd;
  exception when others then
    raise notice 'auth.users nao limpo: %', sqlerrm;
  end;

  -- 3.4 Eventos de autenticacao que citam os ids orfaos (melhor esforço)
  begin
    if to_regclass('auth.audit_log_entries') is not null then
      delete from auth.audit_log_entries a
       where exists (
               select 1 from unnest(v_ids) t(id)
                where a.payload::text like '%' || t.id::text || '%'
             );
    end if;
  exception when others then
    raise notice 'auth.audit_log_entries ignorado: %', sqlerrm;
  end;

  raise notice 'LIMPEZA DE CONTAS ORFAS -> ids: % | identidades: % | contas de login: % | auditoria: %',
               cardinality(v_ids), v_identidades, v_contas, v_auditoria;
end $$;

-- -----------------------------------------------------------------------------
-- 4) VERIFICACAO
-- -----------------------------------------------------------------------------
-- Deve retornar 0 em tudo (nenhuma identidade/conta sem perfil).
select
  (select count(*) from auth.users us
    where not exists (select 1 from public.usuarios u where u.id = us.id))          as contas_orfas_restantes,
  (select count(*) from auth.identities i
    where not exists (select 1 from public.usuarios u where u.id = i.user_id))       as identidades_orfas_restantes;

select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('excluir_usuario_completo', 'limpar_auth_orfao');
