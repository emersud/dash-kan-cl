-- =============================================================================
-- EDUPROJECT AGILE - MIGRACAO 0013: AVALIACAO POR PARES (PEER EVALUATION)
-- -----------------------------------------------------------------------------
-- Modulo descrito em Peer_Evaluation.md, integrado as estruturas existentes
-- (usuarios, equipes/equipe_membros) SEM duplicar cadastros.
--
-- O QUE CRIA:
--   * avaliacoes_periodos  -> periodo/Sprint (rascunho | aberto | encerrado)
--   * peer_avaliacoes      -> avaliacao de um ALUNO por outro ALUNO no periodo
--                             (5 notas 1-5 + comentario opcional + estado)
--   * RPC peer_resultados  -> medias recebidas por aluno/periodo (agregadas)
--
-- REGRAS DE NEGOCIO (validadas no SERVIDOR, nao so na interface):
--   * sem autoavaliação (avaliador <> avaliado);
--   * avaliador e avaliado sao ALUNOS e pertencem a MESMA equipe;
--   * somente periodo 'aberto' aceita criar/editar (erro claro se encerrado);
--   * UNIQUE (periodo_id, avaliador_id, avaliado_id) -> 1 avaliacao por par;
--   * notas inteiras de 1 a 5 (NULL permitido apenas em RASCUNHO);
--   * estado 'enviada' exige os 5 criterios preenchidos;
--   * o avaliador so grava em SEU nome (auth.uid());
--   * apenas 'enviada' entra nas medias (rascunho fica de fora).
--
-- PRIVACIDADE:
--   * RLS: o ALUNO le apenas as linhas que ele mesmo escreveu. As medias que
--     ele RECEBEU vao pela RPC peer_resultados (agregadas, sem identidade de
--     quem avaliou). O PROFESSOR/GESTOR le as linhas brutas (comentarios
--     identificados) e todos os resultados.
--   * NAO ha trigger de auditoria nesta tabela: historico_acoes e legivel por
--     qualquer autenticado e exporia o texto dos comentarios.
--
-- EQUIPE: a equipe fica registrada em cada avaliacao (foto da composicao no
-- momento do envio), porque o sistema nao guarda historico de mudancas de
-- equipe - nao se infere retrospectivamente o grupo atual.
--
-- SEED DEMO (final do arquivo): 3 periodos + avaliacoes de demonstracao
-- geradas a partir das EQUIPES REAIS do banco (marcadas com [DEMO-PEER]),
-- apenas para VALIDACAO DO AMBIENTE em qualquer base ja populada.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TIPOS CUSTOMIZADOS (ENUM)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'avaliacao_periodo_estado') then
    create type public.avaliacao_periodo_estado as enum ('rascunho', 'aberto', 'encerrado');
  end if;
  if not exists (select 1 from pg_type where typname = 'peer_avaliacao_estado') then
    create type public.peer_avaliacao_estado as enum ('rascunho', 'enviada');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. TABELAS
-- -----------------------------------------------------------------------------
create table if not exists public.avaliacoes_periodos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  data_inicio date,
  data_final  date,
  estado      public.avaliacao_periodo_estado not null default 'aberto',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (data_inicio is null or data_final is null or data_final >= data_inicio)
);

create table if not exists public.peer_avaliacoes (
  id                uuid primary key default gen_random_uuid(),
  periodo_id        uuid not null references public.avaliacoes_periodos (id) on delete cascade,
  equipe_id         uuid not null references public.equipes (id) on delete cascade,
  avaliador_id      uuid not null references public.usuarios (id) on delete cascade,
  avaliado_id       uuid not null references public.usuarios (id) on delete cascade,
  colaboracao       smallint,
  responsabilidade  smallint,
  comunicacao       smallint,
  qualidade_entregas smallint,
  autonomia         smallint,
  comentario        text,
  estado            public.peer_avaliacao_estado not null default 'rascunho',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint peer_avaliacoes_par_unica unique (periodo_id, avaliador_id, avaliado_id),
  constraint peer_avaliacoes_sem_autoavaliacao check (avaliador_id <> avaliado_id),
  constraint peer_avaliacoes_colaboracao check (colaboracao is null or colaboracao between 1 and 5),
  constraint peer_avaliacoes_responsabilidade check (responsabilidade is null or responsabilidade between 1 and 5),
  constraint peer_avaliacoes_comunicacao check (comunicacao is null or comunicacao between 1 and 5),
  constraint peer_avaliacoes_qualidade check (qualidade_entregas is null or qualidade_entregas between 1 and 5),
  constraint peer_avaliacoes_autonomia check (autonomia is null or autonomia between 1 and 5)
);

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS DE updated_at
-- -----------------------------------------------------------------------------
drop trigger if exists trg_avaliacoes_periodos_updated on public.avaliacoes_periodos;
create trigger trg_avaliacoes_periodos_updated before update on public.avaliacoes_periodos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_peer_avaliacoes_updated on public.peer_avaliacoes;
create trigger trg_peer_avaliacoes_updated before update on public.peer_avaliacoes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. TRIGGER DE VALIDACAO DAS REGRAS DE NEGOCIO
-- -----------------------------------------------------------------------------
create or replace function public.peer_avaliacao_validar()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_estado_periodo public.avaliacao_periodo_estado;
  v_papel_avaliador public.user_papel;
  v_papel_avaliado  public.user_papel;
  v_membros_ok      boolean;
begin
  -- Estado do periodo (sempre conferido; periodo inexistente = erro)
  select estado into v_estado_periodo
    from public.avaliacoes_periodos
   where id = new.periodo_id;

  if v_estado_periodo is null then
    raise exception 'Periodo de avaliacao nao encontrado.';
  end if;

  -- Regras de sessao: valem para toda escrita vinda da aplicacao.
  -- (auth.uid() nulo = SQL Editor/migracao - seed e manutencao do banco.)
  if auth.uid() is not null then
    if new.avaliador_id <> auth.uid() then
      raise exception 'Voce so pode registrar avaliacoes em seu proprio nome.';
    end if;
    if v_estado_periodo <> 'aberto' then
      raise exception 'O periodo foi encerrado e nao aceita alteracoes.';
    end if;
  end if;

  -- Integridade dos dados (vale tambem para seed/manutencao)
  select papel into v_papel_avaliador from public.usuarios where id = new.avaliador_id;
  select papel into v_papel_avaliado  from public.usuarios where id = new.avaliado_id;

  if v_papel_avaliador is distinct from 'aluno' or v_papel_avaliado is distinct from 'aluno' then
    raise exception 'Apenas alunos podem participar da avaliacao por pares.';
  end if;

  select (
    exists (select 1 from public.equipe_membros em
             where em.equipe_id = new.equipe_id and em.aluno_id = new.avaliador_id)
    and exists (select 1 from public.equipe_membros em
             where em.equipe_id = new.equipe_id and em.aluno_id = new.avaliado_id)
  ) into v_membros_ok;

  if not v_membros_ok then
    raise exception 'Avaliador e avaliado precisam fazer parte da mesma equipe.';
  end if;

  -- Envio completo: os 5 criterios sao obrigatorios (sem nota "0" nem lacuna).
  if new.estado = 'enviada'
     and (new.colaboracao is null
       or new.responsabilidade is null
       or new.comunicacao is null
       or new.qualidade_entregas is null
       or new.autonomia is null) then
    raise exception 'Informe uma nota de 1 a 5 em todos os criterios antes de enviar.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_peer_avaliacao_validar on public.peer_avaliacoes;
create trigger trg_peer_avaliacao_validar
  before insert or update on public.peer_avaliacoes
  for each row
  execute function public.peer_avaliacao_validar();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY E POLICIES
-- -----------------------------------------------------------------------------
alter table public.avaliacoes_periodos enable row level security;
alter table public.peer_avaliacoes enable row level security;

-- -------- PERIODOS --------
drop policy if exists "periodos_select_authenticated" on public.avaliacoes_periodos;
create policy "periodos_select_authenticated" on public.avaliacoes_periodos
  for select to authenticated using (true);

drop policy if exists "periodos_manage_professor" on public.avaliacoes_periodos;
create policy "periodos_manage_professor" on public.avaliacoes_periodos
  for all to authenticated
  using (public.is_professor())
  with check (public.is_professor());

-- -------- AVALIACOES --------
-- SELECT: professor/gestor ve tudo; aluno ve apenas o que ELE gravou.
-- (As medias recebidas vem agregadas pela RPC peer_resultados.)
drop policy if exists "peer_avaliacoes_select_own_or_professor" on public.peer_avaliacoes;
create policy "peer_avaliacoes_select_own_or_professor" on public.peer_avaliacoes
  for select to authenticated
  using (public.is_professor() or avaliador_id = auth.uid());

-- INSERT: somente em nome proprio (o trigger confirma papel/equipe/período).
drop policy if exists "peer_avaliacoes_insert_own" on public.peer_avaliacoes;
create policy "peer_avaliacoes_insert_own" on public.peer_avaliacoes
  for insert to authenticated
  with check (avaliador_id = auth.uid());

-- UPDATE: apenas o proprio avaliador, enquanto o periodo estiver aberto
-- (estado e checado no trigger - a interface nao e a unica barreira).
drop policy if exists "peer_avaliacoes_update_own" on public.peer_avaliacoes;
create policy "peer_avaliacoes_update_own" on public.peer_avaliacoes
  for update to authenticated
  using (avaliador_id = auth.uid())
  with check (avaliador_id = auth.uid());

-- DELETE: o proprio avaliador enquanto o periodo estiver aberto, ou
-- professor/gestor (moderacao de comentario impróprio).
drop policy if exists "peer_avaliacoes_delete_own_or_professor" on public.peer_avaliacoes;
create policy "peer_avaliacoes_delete_own_or_professor" on public.peer_avaliacoes
  for delete to authenticated
  using (
    public.is_professor()
    or (
      avaliador_id = auth.uid()
      and exists (
        select 1 from public.avaliacoes_periodos p
         where p.id = peer_avaliacoes.periodo_id
           and p.estado = 'aberto'
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 6. RPC: MEDIAS RECEBIDAS (agregadas por aluno e periodo)
--    - somente avaliacoes 'enviada' entram;
--    - professor/gestor: todos os alunos; aluno: apenas ele mesmo;
--    - media por criterio com a QUANTIDADE de respostas validas;
--    - criterio sem resposta volta NULL (a interface exibe "Sem dados").
-- -----------------------------------------------------------------------------
create or replace function public.peer_resultados(p_periodo_id uuid default null)
returns table (
  periodo_id        uuid,
  avaliado_id       uuid,
  equipe_id         uuid,
  avaliado_nome     text,
  total_avaliacoes  integer,
  colaboracao       numeric,
  colaboracao_n     integer,
  responsabilidade  numeric,
  responsabilidade_n integer,
  comunicacao       numeric,
  comunicacao_n     integer,
  qualidade_entregas numeric,
  qualidade_entregas_n integer,
  autonomia         numeric,
  autonomia_n       integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.periodo_id,
    a.avaliado_id,
    a.equipe_id,
    u.nome,
    count(*)::integer,
    avg(a.colaboracao),      count(a.colaboracao)::integer,
    avg(a.responsabilidade), count(a.responsabilidade)::integer,
    avg(a.comunicacao),      count(a.comunicacao)::integer,
    avg(a.qualidade_entregas), count(a.qualidade_entregas)::integer,
    avg(a.autonomia),        count(a.autonomia)::integer
  from public.peer_avaliacoes a
  join public.usuarios u on u.id = a.avaliado_id
  where a.estado = 'enviada'
    and (p_periodo_id is null or a.periodo_id = p_periodo_id)
    and (public.is_professor() or a.avaliado_id = auth.uid())
  group by a.periodo_id, a.avaliado_id, a.equipe_id, u.nome;
$$;

revoke all on function public.peer_resultados(uuid) from public;
revoke all on function public.peer_resultados(uuid) from anon;
grant execute on function public.peer_resultados(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. PRIVILEGIOS DAS TABELAS NOVAS
--    (o grant geral do 0001 vale apenas para as tabelas existentes na época)
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.avaliacoes_periodos to authenticated;
grant select, insert, update, delete on public.peer_avaliacoes to authenticated;
revoke all on public.avaliacoes_periodos from anon;
revoke all on public.peer_avaliacoes from anon;

-- -----------------------------------------------------------------------------
-- 8. SEED DEMO (idempotente) - SOMENTE PARA VALIDACAO DO AMBIENTE
--    * 3 periodos com IDs fixos (Sprint 1 encerrado, Sprint 2 aberto, Sprint 3
--      rascunho) - criados sempre, em qualquer base.
--    * Avaliacoes de demonstracao geradas a partir das EQUIPES REAIS existentes:
--      cada ALUNO avalia os colegas da PROPRIA equipe nos periodos Sprint 1
--      (encerrado, base da evolucao) e Sprint 2 (aberto). Assim o modulo pode
--      ser validado num banco ja populado (alunos importados), sem depender dos
--      IDs do 0002_seed.
--    * Toda linha de demonstracao tem a marcacao "[DEMO-PEER]" no comentario;
--      um DELETE por essa marcacao torna a reexecucao segura e adaptada a
--      qualquer mudanca de equipe.
--    * NUNCA sobrescreve dados reais: pares que ja possuem avaliacao no periodo
--      (do proprio aluno) sao pulados.
--    * Notas 3..5 derivadas de hash do par (deterministicas, mesmas em toda
--      reexecucao). ~20% dos pares viram RASCUNHO parcial para validar que
--      rascunho nao entra nas medias.
-- -----------------------------------------------------------------------------
do $$
declare
  v_periodo_encerrado uuid := 'dddddddd-0000-4000-8000-000000000001';
  v_periodo_aberto    uuid := 'dddddddd-0000-4000-8000-000000000002';
  v_periodo_rascunho  uuid := 'dddddddd-0000-4000-8000-000000000003';
  v_avaliador uuid;
  v_avaliado  uuid;
  v_equipe    uuid;
  v_periodo   uuid;
  v_chave     text;
  v_hash      text;
  v_rascunho  boolean;
  v_total     integer := 0;
  v_rascunhos integer := 0;
  v_pular      integer := 0;
begin
  insert into public.avaliacoes_periodos (id, nome, data_inicio, data_final, estado) values
    (v_periodo_encerrado, 'Sprint 1', '2026-08-03', '2026-08-28', 'encerrado'),
    (v_periodo_aberto,    'Sprint 2', '2026-09-01', '2026-10-31', 'aberto'),
    (v_periodo_rascunho,  'Sprint 3', '2026-11-02', '2026-11-27', 'rascunho')
  on conflict (id) do nothing;

  -- limpa somente as linhas de demonstracao de execucoes anteriores
  delete from public.peer_avaliacoes where comentario like '[DEMO-PEER]%';

  if not exists (select 1 from public.equipe_membros) then
    raise notice 'SEED DEMO 0013: nenhuma equipe encontrada - apenas os 3 periodos foram criados.';
    return;
  end if;

  -- Todos os pares (avaliador, avaliado) de cada equipe
  for v_avaliador, v_avaliado, v_equipe in
    select a.aluno_id, b.aluno_id, a.equipe_id
      from public.equipe_membros a
      join public.equipe_membros b
        on b.equipe_id = a.equipe_id
       and b.aluno_id <> a.aluno_id
     order by a.equipe_id, a.aluno_id, b.aluno_id
  loop
    -- So gera demo se ainda NAO existir avaliacao real para este par no periodo
    for v_periodo in select unnest(array[v_periodo_encerrado, v_periodo_aberto])::uuid loop
      if exists (
        select 1 from public.peer_avaliacoes pa
         where pa.periodo_id = v_periodo
           and pa.avaliador_id = v_avaliador
           and pa.avaliado_id = v_avaliado
      ) then
        v_pular := v_pular + 1;
        continue;
      end if;

      v_chave := v_avaliador::text || '|' || v_avaliado::text || '|' || v_periodo::text;
      v_hash  := md5(v_chave);
      -- ~20% dos pares viram rascunho parcial (só 1 ou 2 notas preenchidas)
      v_rascunho := (ascii(substr(v_hash, 1, 1)) % 5) = 0;

      insert into public.peer_avaliacoes
        (periodo_id, equipe_id, avaliador_id, avaliado_id,
         colaboracao, responsabilidade, comunicacao, qualidade_entregas, autonomia,
         comentario, estado)
      values (
        v_periodo,
        v_equipe,
        v_avaliador,
        v_avaliado,
        -- rascunho: só 1 ou 2 notas preenchidas (as demais ficam nulas)
        3 + (ascii(substr(v_hash, 1, 1)) % 3),
        case when v_rascunho then null else 3 + (ascii(substr(v_hash, 2, 1)) % 3) end,
        case when v_rascunho and ascii(substr(v_hash, 3, 1)) % 2 <> 0 then null
             else 3 + (ascii(substr(v_hash, 3, 1)) % 3) end,
        case when v_rascunho then null else 3 + (ascii(substr(v_hash, 4, 1)) % 3) end,
        case when v_rascunho then null else 3 + (ascii(substr(v_hash, 5, 1)) % 3) end,
        case when v_rascunho
             then '[DEMO-PEER] Rascunho de demonstracao (nao entra nas medias).'
             else '[DEMO-PEER] Dados de demonstracao para validacao do ambiente.' end,
        case when v_rascunho then 'rascunho'::public.peer_avaliacao_estado
             else 'enviada'::public.peer_avaliacao_estado end
      );

      if v_rascunho then v_rascunhos := v_rascunhos + 1; end if;
      v_total := v_total + 1;
    end loop;
  end loop;

  raise notice 'SEED DEMO 0013 aplicado: 3 periodos + % avaliacoes de demonstracao (% rascunhos, % pares ja existentes preservados).',
    v_total, v_rascunhos, v_pular;
end $$;

-- -----------------------------------------------------------------------------
-- 9. VERIFICACAO
-- -----------------------------------------------------------------------------
select
  (select count(*) from public.avaliacoes_periodos) as periodos,
  (select count(*) from public.peer_avaliacoes) as avaliacoes,
  (select count(*) from public.peer_avaliacoes where estado = 'enviada') as enviadas,
  (select count(*) from public.peer_avaliacoes where estado = 'rascunho') as rascunhos,
  (select count(*) from pg_proc where proname = 'peer_resultados') as rpc_peer_resultados;
