-- =============================================================================
-- MIGRAÇÃO 0014 — peer_resultados AGRUPADA POR ALUNO + PERÍODO (sem duplicidade)
-- Aplicar no SQL Editor do Supabase (idempotente — create or replace).
--
-- PROBLEMA (encontrado pelo smoke test tests/smoke.peers.mjs após aplicar a 0013):
--   a versão da 0013 agrupava por periodo_id + avaliado_id + equipe_id. Aluno
--   membro de MAIS DE UMA equipe (mix multi-turma) recebia UMA LINHA POR EQUIPE:
--     * a tabela "Evolução entre períodos" quebrava com
--       "Warning: Encountered two children with the same key" (chave = periodo);
--     * o radar do aluno e o painel do professor usavam resultados.find(...)
--       e exibiam APENAS a primeira linha -> a média mostrava só uma parte das
--       avaliações recebidas (ex.: 2 de 5 no Sprint 2).
--
-- CORREÇÃO: agrupar por periodo_id + avaliado_id (uma linha por aluno/período,
--   conforme Peer_Evaluation.md item 7 — "média recebida em cada critério, por
--   aluno e período" — e conforme o modo mock, que já agrupava por
--   `periodo_id|avaliado_id` em dataService.listarPeerResultados).
--   A equipe exibida passa a ser a EQUIPE REPRESENTATIVA: a de mais avaliações
--   no período (empate -> menor uuid, para sair sempre igual).
--
-- EFEITOS:
--   * mesma assinatura (p_periodo_id uuid) -> grants/policies da 0013 seguem
--     válidos; privacidade intacta (aluno só vê a própria linha, via auth.uid());
--   * contagem de respostas (total_avaliacoes e *_n) passa a somar as equipes;
--   * as médias continuam sendo calculadas só sobre avaliações 'enviada'.
--
-- VERIFICAÇÃO: rodar o arquivo inteiro e depois conferir na aplicação
--   (professor -> Avaliação por Pares -> aluno em 2 equipes -> uma linha por
--    período) ou pelo SQL abaixo, QUE EXIGE JUTA (a função usa auth.uid()):
--     select periodo_id, avaliado_id, count(*)
--       from public.peer_avaliacoes
--      where estado = 'enviada'
--      group by 1, 2
--     having count(*) > 0;   -- deve bater 1x1 com peer_resultados na app
--   No SQL Editor (sem sessão de usuário) peer_resultados() devolve 0 linhas:
--   auth.uid() é nulo -> is_professor() falso. Isso é esperado, não é falha.
-- =============================================================================

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
  with base as (
    select
      a.periodo_id  as periodo_id,
      a.avaliado_id as avaliado_id,
      a.equipe_id   as equipe_id,
      u.nome        as avaliado_nome,
      a.colaboracao,
      a.responsabilidade,
      a.comunicacao,
      a.qualidade_entregas,
      a.autonomia
    from public.peer_avaliacoes a
    join public.usuarios u on u.id = a.avaliado_id
    where a.estado = 'enviada'
      and (p_periodo_id is null or a.periodo_id = p_periodo_id)
      and (public.is_professor() or a.avaliado_id = auth.uid())
  ),
  por_equipe as (
    select
      b2.periodo_id  as periodo_id,
      b2.avaliado_id as avaliado_id,
      b2.equipe_id   as equipe_id,
      count(*)::integer as qtd
    from base b2
    group by b2.periodo_id, b2.avaliado_id, b2.equipe_id
  ),
  equipe_principal as (
    -- uma linha por aluno/período, com a equipe de mais avaliações
    select distinct on (e3.periodo_id, e3.avaliado_id)
      e3.periodo_id  as periodo_id,
      e3.avaliado_id as avaliado_id,
      e3.equipe_id   as equipe_id
    from por_equipe e3
    order by e3.periodo_id, e3.avaliado_id, e3.qtd desc, e3.equipe_id
  )
  select
    b.periodo_id,
    b.avaliado_id,
    ep.equipe_id,
    max(b.avaliado_nome)::text,
    count(*)::integer,
    avg(b.colaboracao),         count(b.colaboracao)::integer,
    avg(b.responsabilidade),    count(b.responsabilidade)::integer,
    avg(b.comunicacao),         count(b.comunicacao)::integer,
    avg(b.qualidade_entregas),  count(b.qualidade_entregas)::integer,
    avg(b.autonomia),           count(b.autonomia)::integer
  from base b
  join equipe_principal ep
    on ep.periodo_id = b.periodo_id
   and ep.avaliado_id = b.avaliado_id
  group by b.periodo_id, b.avaliado_id, ep.equipe_id
  order by b.periodo_id, max(b.avaliado_nome);
$$;

-- Grants idempotentes (mesma regra da 0013: somente autenticados; a assinatura
-- da função não mudou, então os grants originais já continuariam válidos).
revoke all on function public.peer_resultados(uuid) from public;
revoke all on function public.peer_resultados(uuid) from anon;
grant execute on function public.peer_resultados(uuid) to authenticated;
