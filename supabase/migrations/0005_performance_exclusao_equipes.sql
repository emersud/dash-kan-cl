-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0005: PERFORMANCE NA EXCLUSÃO DE EQUIPES
-- -----------------------------------------------------------------------------
-- Causas da lentidão/travamento ao excluir equipes:
--
--   1) FALTAVA ÍNDICE em daily_registers.equipe_id (FK com ON DELETE CASCADE).
--      Essa é a tabela que mais cresce (1 linha/aluno/dia); sem índice, CADA
--      exclusão de equipe faz um sequential scan nela para localizar os filhos.
--
--   2) Auditoria POR LINHA em todas as tabelas em cascata: excluir 1 equipe
--      gerava 1 INSERT em historico_acoes por membro + por check-in + por
--      tarefa, cada um serializando a linha inteira em jsonb (2x). O DELETE
--      deixava de ser O(1) e passava a ser proporcional ao tamanho dos dados.
--
-- Correções:
--   A) Índice idx_daily_equipe (cascata vira index scan).
--   B) audit_acao() serializa o jsonb da linha UMA única vez por operação.
--   C) daily_registers: os DELETEs passam a ser auditados EM LOTE (1 linha de
--      auditoria por instrução, via trigger de nível de instrução com tabela
--      de transição) em vez de 1 linha por check-in excluído. INSERT/UPDATE
--      continuam auditados linha a linha (baixo volume, detalhe mantido).
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) ÍNDICE DA CASCATA EM daily_registers
-- -----------------------------------------------------------------------------
create index if not exists idx_daily_equipe on public.daily_registers (equipe_id);

-- -----------------------------------------------------------------------------
-- B) audit_acao() — serialização de jsonb única por operação
--     (antes: to_jsonb(old) e to_jsonb(new) eram calculados sempre, mesmo
--      quando não se aplicavam, dobrando o custo de CPU por linha auditada)
-- -----------------------------------------------------------------------------
create or replace function public.audit_acao()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_anteriores jsonb;
  v_novos      jsonb;
begin
  if tg_op = 'DELETE' then
    v_anteriores := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_novos := to_jsonb(new);
  else
    v_anteriores := to_jsonb(old);
    v_novos      := to_jsonb(new);
  end if;

  insert into public.historico_acoes (
    nome_tabela, registro_id, tipo_acao, usuario_id, dados_anteriores, dados_novos
  ) values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    v_anteriores,
    v_novos
  );
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- C) Auditoria EM LOTE dos DELETEs em daily_registers
--     Uma única linha de auditoria por instrução de delete (inclusive a
--     cascata disparada pela exclusão de equipes/usuarios), em vez de milhares
--     de inserts individuais.
-- -----------------------------------------------------------------------------
create or replace function public.audit_daily_lote()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_qtd        integer;
  v_ini        date;
  v_fim        date;
  v_equipe_ref uuid;
begin
  select count(*), min(data_checkin), max(data_checkin)
    into v_qtd, v_ini, v_fim
    from old_table;

  if coalesce(v_qtd, 0) = 0 then
    return null;
  end if;

  -- registro_id: equipe afetada quando o lote é de uma única equipe
  select equipe_id into v_equipe_ref from old_table limit 1;
  if exists (select 1 from old_table where equipe_id is distinct from v_equipe_ref) then
    v_equipe_ref := null;
  end if;

  insert into public.historico_acoes (
    nome_tabela, registro_id, tipo_acao, usuario_id, dados_anteriores, dados_novos
  ) values (
    tg_table_name,
    coalesce(v_equipe_ref, '00000000-0000-0000-0000-000000000000'::uuid),
    'DELETE',
    auth.uid(),
    jsonb_build_object(
      'lote', true,
      'linhas_excluidas', v_qtd,
      'periodo', jsonb_build_object('de', v_ini, 'ate', v_fim)
    ),
    null
  );
  return null;
end;
$$;

-- INSERT/UPDATE continuam linha a linha (mantém o detalhe da auditoria)
drop trigger if exists trg_audit_daily on public.daily_registers;
create trigger trg_audit_daily
  after insert or update on public.daily_registers
  for each row execute function public.audit_acao();

-- DELETE em lote: 1 linha de auditoria por instrução (inclusive cascata)
drop trigger if exists trg_audit_daily_lote on public.daily_registers;
create trigger trg_audit_daily_lote
  after delete on public.daily_registers
  referencing old table as old_table
  for each statement execute function public.audit_daily_lote();

-- -----------------------------------------------------------------------------
-- Verificação
-- -----------------------------------------------------------------------------
select indexname
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'daily_registers'
 order by indexname;

select tgname, tgtype
  from pg_trigger
 where tgrelid = 'public.daily_registers'::regclass
   and not tgisinternal
 order by tgname;
