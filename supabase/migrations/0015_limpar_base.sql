-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0015: ZERAR BASE (DESTRUTIVO)
-- -----------------------------------------------------------------------------
-- Apaga TODO o conteúdo de negócio do banco (e as contas de login) para poder
-- recriar um ambiente de teste do zero com a 0016_seed_completo_demo.sql.
--
-- O QUE APAGA (nesta ordem, respeitando todas as FKs):
--   peer_avaliacoes -> avaliacoes_periodos -> checklists -> historico_atividades
--   -> daily_registers -> tarefas -> projeto_equipes -> projetos -> equipe_membros
--   -> equipes -> usuarios -> turmas -> historico_acoes (auditoria)
--   -> auth.identities -> auth.users (contas de login)
--   + objetos dos buckets avatares/logos do 0012 (melhor esforço).
--
-- O QUE NÃO MEXE:
--   schema (tabelas/colunas/índices/enums), funções e RPCs, policies/RLS,
--   triggers, extensões. Isto é um RESET de dados, não um rollback de migração.
--
-- SEGURANÇA (obrigatória):
--   O script NÃO apaga nada na rodada padrão. Ele só relata o que existe.
--   Para apagar de verdade, troque a linha
--         v_confirmar boolean := false;
--   para
--         v_confirmar boolean := true;
--   e rode novamente no SQL Editor do Supabase.
--
-- FLUXO DE TESTE COMPLETO:
--   1) rode 0015_limpar_base.sql      (v_confirmar := true)  -> base zerada;
--   2) rode 0016_seed_completo_demo.sql                       -> base povoada;
--   3) faça login (credenciais no cabeçalho da 0016).
--   Obs.: a 0016 também roda sozinha sobre uma base já populada (ela limpa
--   apenas os dados de demonstração que ela própria cria — idempotente).
--
-- COMO APLICAR: SQL Editor do Supabase -> colar este arquivo -> trocar
--   v_confirmar para true -> Run -> conferir o relatório final (tudo 0).
-- =============================================================================

do $limpar$
declare
  v_confirmar boolean := false;   -- <<< MUDE PARA true PARA APAGAR DE VERDADE
  v_antes     text;
begin
  -- ---------------------------------------------------------------------
  -- 0) Relatório do que existe HOJE (antes de qualquer exclusão)
  -- ---------------------------------------------------------------------
  select coalesce(string_agg(t.n || '=' || t.c, ', ' order by t.n), 'base vazia')
    into v_antes
  from (
    select 'usuarios'              n, count(*)::text c from public.usuarios
    union all select 'auth.users',        count(*)::text from auth.users
    union all select 'turmas',            count(*)::text from public.turmas
    union all select 'equipes',           count(*)::text from public.equipes
    union all select 'equipe_membros',    count(*)::text from public.equipe_membros
    union all select 'projetos',          count(*)::text from public.projetos
    union all select 'projeto_equipes',   count(*)::text from public.projeto_equipes
    union all select 'tarefas',           count(*)::text from public.tarefas
    union all select 'checklists',        count(*)::text from public.checklists
    union all select 'daily_registers',   count(*)::text from public.daily_registers
    union all select 'historico_atividades', count(*)::text from public.historico_atividades
    union all select 'avaliacoes_periodos',  count(*)::text from public.avaliacoes_periodos
    union all select 'peer_avaliacoes',      count(*)::text from public.peer_avaliacoes
    union all select 'historico_acoes',      count(*)::text from public.historico_acoes
  ) t;

  raise notice 'CONTEUDO ATUAL DA BASE: %', v_antes;

  if not v_confirmar then
    raise notice 'MODO SEGURO ATIVO (v_confirmar = false): NADA FOI APAGADO.';
    raise notice 'Para zerar de verdade, troque v_confirmar para true e rode novamente.';
    return;
  end if;

  -- ---------------------------------------------------------------------
  -- 1) Exclusões (filhos antes dos pais)
  -- ---------------------------------------------------------------------
  delete from public.peer_avaliacoes;        -- FK: periodos, equipes, usuarios
  delete from public.avaliacoes_periodos;
  delete from public.checklists;             -- FK: tarefas
  delete from public.historico_atividades;   -- FK: usuarios, tarefas
  delete from public.daily_registers;        -- FK: equipes, usuarios
  delete from public.tarefas;                -- FK: projetos, equipes, usuarios
  delete from public.projeto_equipes;        -- FK: projetos, equipes
  delete from public.projetos;
  delete from public.equipe_membros;         -- FK: equipes, usuarios
  delete from public.equipes;
  delete from public.usuarios;               -- FK: turmas, auth.users
  delete from public.turmas;
  delete from public.historico_acoes;        -- auditoria (sempre por último)

  delete from auth.identities;               -- FK: auth.users
  delete from auth.users;                    -- contas de login (cascata p/ usuarios)

  -- ---------------------------------------------------------------------
  -- 2) Objetos de mídia do 0012 (melhor esforço: pode não existir/permissão)
  -- ---------------------------------------------------------------------
  if to_regclass('storage.objects') is not null then
    begin
      delete from storage.objects where bucket_id in ('avatares', 'logos');
      if to_regclass('storage.buckets') is not null then
        delete from storage.buckets where id in ('avatares', 'logos');
      end if;
    exception when others then
      raise notice 'AVISO: buckets de mídia nao foram removidos (%)', sqlerrm;
    end;
  end if;

  -- ---------------------------------------------------------------------
  -- 3) Reinicia a sequência da auditoria
  -- ---------------------------------------------------------------------
  if to_regclass('public.historico_acoes_id_seq') is not null then
    perform setval('public.historico_acoes_id_seq', 1, false);
  end if;

  raise notice 'BASE ZERADA: todos os dados de negocio e contas de login foram removidos.';
end $limpar$;

-- -----------------------------------------------------------------------------
-- Relatório final (deve sair tudo 0 — inclusive quando o modo seguro recusou)
-- -----------------------------------------------------------------------------
select 'usuarios' as tabela, count(*) as linhas from public.usuarios
union all select 'auth.users',         count(*) from auth.users
union all select 'turmas',             count(*) from public.turmas
union all select 'equipes',            count(*) from public.equipes
union all select 'equipe_membros',     count(*) from public.equipe_membros
union all select 'projetos',           count(*) from public.projetos
union all select 'projeto_equipes',    count(*) from public.projeto_equipes
union all select 'tarefas',            count(*) from public.tarefas
union all select 'checklists',         count(*) from public.checklists
union all select 'daily_registers',    count(*) from public.daily_registers
union all select 'historico_atividades', count(*) from public.historico_atividades
union all select 'avaliacoes_periodos',  count(*) from public.avaliacoes_periodos
union all select 'peer_avaliacoes',      count(*) from public.peer_avaliacoes
union all select 'historico_acoes',      count(*) from public.historico_acoes
order by 1;
