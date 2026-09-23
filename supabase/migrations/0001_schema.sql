-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0001: SCHEMA (DDL)
-- -------------------------------------------------------------
-- Engenharia reversa dos mocks (mockData.js / dataService.js) para o Supabase.
-- Origem das entidades: Fases 1–11 registradas em LOG.txt e telas das páginas.
-- Relacionamentos normalizados (3FN):
--   * equipes.membros      -> tabela equipe_membros (N:N aluno<->equipe)
--   * projetos.equipes_ids -> tabela projeto_equipes  (N:N equipe<->projeto)
--   * tarefas.checklists   -> tabela checklists       (1:N tarefa<->checklist)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSÕES
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 2. TIPOS CUSTOMIZADOS (ENUM)
--    (valores extraídos do mock e das regras de permissão/Fases)
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_papel') then
    create type public.user_papel as enum ('gestor', 'professor', 'aluno');
  end if;
  if not exists (select 1 from pg_type where typname = 'tarefa_prioridade') then
    create type public.tarefa_prioridade as enum ('baixa', 'media', 'alta', 'urgente');
  end if;
  if not exists (select 1 from pg_type where typname = 'tarefa_status') then
    create type public.tarefa_status as enum ('backlog', 'a_fazer', 'fazendo', 'concluido');
  end if;
  if not exists (select 1 from pg_type where typname = 'tarefa_estimativa') then
    create type public.tarefa_estimativa as enum ('P', 'M', 'G', '1', '2', '3', '5', '8');
  end if;
  if not exists (select 1 from pg_type where typname = 'atividade_tipo') then
    create type public.atividade_tipo as enum (
      'daily_checkin', 'concluiu_checklist', 'movimentou_card',
      'comentou', 'bloqueou', 'assumiu_tarefa', 'aprovou_conclusao'
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. TABELAS
-- -----------------------------------------------------------------------------

-- 3.1 TURMAS ----------------------------------------------------------------
create table if not exists public.turmas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  codigo_acesso text unique not null,
  cor_hex       text default '#4f46e5',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3.2 USUÁRIOS (perfil ligado ao auth.users do Supabase) ---------------------
-- id = auth.uid(); senha/credenciais NÃO devem trafegar por aqui no ambiente
-- real (usar Supabase Auth). O campo foi preservado apenas p/ paridade com o
-- mock; no seed os usuários são criados via auth.users + trigger.
create table if not exists public.usuarios (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nome               text not null,
  email              text unique not null,
  senha              text,                      -- deprecado no ambiente real
  papel              public.user_papel not null default 'aluno',
  funcao_principal   text,
  avatar_url         text,
  turma_id           uuid references public.turmas (id) on delete set null,
  primeiro_acesso    boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 3.3 EQUIPES ---------------------------------------------------------------
create table if not exists public.equipes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  logo_url   text,
  github_url text,                              -- adicionado na Fase 7
  cor_hex    text default '#6366f1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.4 EQUIPE_MEMBROS (N:N aluno <-> equipe, com papel no grupo) -------------
-- normalização de equipes.membros[{aluno_id, papel_no_grupo}]
create table if not exists public.equipe_membros (
  id             uuid primary key default gen_random_uuid(),
  equipe_id      uuid not null references public.equipes (id) on delete cascade,
  aluno_id       uuid not null references public.usuarios (id) on delete cascade,
  papel_no_grupo text,
  created_at     timestamptz not null default now(),
  unique (equipe_id, aluno_id)
);

-- 3.5 PROJETOS --------------------------------------------------------------
create table if not exists public.projetos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  data_inicio  date,                            -- adicionado na Fase 8
  data_entrega date,
  recursos     text,                            -- Fase 8: Links/Recursos
  status       text not null default 'em_andamento',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (data_entrega is null or data_inicio is null or data_entrega >= data_inicio)
);

-- 3.6 PROJETO_EQUIPES (N:N equipe <-> projeto) ------------------------------
-- normalização de projetos.equipes_ids[]
create table if not exists public.projeto_equipes (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  equipe_id  uuid not null references public.equipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (projeto_id, equipe_id)
);

-- 3.7 TAREFAS ---------------------------------------------------------------
create table if not exists public.tarefas (
  id                   uuid primary key default gen_random_uuid(),
  projeto_id           uuid not null references public.projetos (id) on delete cascade,
  equipe_id            uuid references public.equipes (id) on delete set null,
  aluno_id             uuid references public.usuarios (id) on delete set null,
  titulo               text not null,
  descricao            text,
  prioridade           public.tarefa_prioridade not null default 'media',
  estimativa           public.tarefa_estimativa,
  status               public.tarefa_status not null default 'backlog',
  posicao              integer not null default 1000,   -- ordenação no kanban
  prazo_limite         timestamptz,
  is_impedida          boolean not null default false,
  aguardando_validacao boolean not null default false,  -- Fase 9: "Em análise"
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 3.8 CHECKLISTS (1:N tarefa -> checklist) ----------------------------------
-- normalização de tarefas.checklists[{id, item, concluido}]
create table if not exists public.checklists (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references public.tarefas (id) on delete cascade,
  item       text not null,
  concluido  boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3.9 HISTORICO_ATIVIDADES (atividade de usuário exibida nas telas) ---------
create table if not exists public.historico_atividades (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tarefa_id  uuid references public.tarefas (id) on delete set null,
  tipo_acao  public.atividade_tipo not null,
  descricao  text,
  data_hora  timestamptz not null default now()
);

-- 3.10 DAILY_REGISTERS ------------------------------------------------------
create table if not exists public.daily_registers (
  id              uuid primary key default gen_random_uuid(),
  equipe_id       uuid not null references public.equipes (id) on delete cascade,
  aluno_id        uuid not null references public.usuarios (id) on delete cascade,
  data_checkin    date not null,
  o_que_fez       text,
  licao_aprendida text,                          -- máx. 280 caracteres (Fase 7)
  impedimento     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (aluno_id, data_checkin)                -- 1 check-in por aluno/dia
);

-- 3.11 HISTORICO_ACOES (auditoria automática do banco) ----------------------
-- Registra INSERT/UPDATE/DELETE nas tabelas sensíveis p/ rastreabilidade.
create table if not exists public.historico_acoes (
  id              bigserial primary key,
  nome_tabela     text not null,
  registro_id     uuid not null,
  tipo_acao       text not null,                 -- INSERT | UPDATE | DELETE
  usuario_id      uuid,
  dados_anteriores jsonb,
  dados_novos     jsonb,
  data_hora       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS
-- -----------------------------------------------------------------------------

-- 4.1 Atualização automática de updated_at ----------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_turmas_updated on public.turmas;
create trigger trg_turmas_updated before update on public.turmas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_usuarios_updated on public.usuarios;
create trigger trg_usuarios_updated before update on public.usuarios
  for each row execute function public.set_updated_at();
drop trigger if exists trg_equipes_updated on public.equipes;
create trigger trg_equipes_updated before update on public.equipes
  for each row execute function public.set_updated_at();
drop trigger if exists trg_projetos_updated on public.projetos;
create trigger trg_projetos_updated before update on public.projetos
  for each row execute function public.set_updated_at();
drop trigger if exists trg_tarefas_updated on public.tarefas;
create trigger trg_tarefas_updated before update on public.tarefas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_daily_updated on public.daily_registers;
create trigger trg_daily_updated before update on public.daily_registers
  for each row execute function public.set_updated_at();

-- 4.2 Criação automática do perfil ao criar usuário no Supabase Auth --------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.usuarios (
    id, nome, email, papel, funcao_principal, avatar_url, turma_id, primeiro_acesso
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'papel'), 'aluno')::public.user_papel,
    new.raw_user_meta_data ->> 'funcao_principal',
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'turma_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'primeiro_acesso')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.3 Auditoria automática --------------------------------------------------
create or replace function public.audit_acao()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.historico_acoes (
    nome_tabela, registro_id, tipo_acao, usuario_id, dados_anteriores, dados_novos
  ) values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- aplica auditoria nas tabelas de negócio
drop trigger if exists trg_audit_usuarios on public.usuarios;
create trigger trg_audit_usuarios after insert or update or delete on public.usuarios
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_turmas on public.turmas;
create trigger trg_audit_turmas after insert or update or delete on public.turmas
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_equipes on public.equipes;
create trigger trg_audit_equipes after insert or update or delete on public.equipes
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_equipe_membros on public.equipe_membros;
create trigger trg_audit_equipe_membros after insert or update or delete on public.equipe_membros
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_projetos on public.projetos;
create trigger trg_audit_projetos after insert or update or delete on public.projetos
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_projeto_equipes on public.projeto_equipes;
create trigger trg_audit_projeto_equipes after insert or update or delete on public.projeto_equipes
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_tarefas on public.tarefas;
create trigger trg_audit_tarefas after insert or update or delete on public.tarefas
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_checklists on public.checklists;
create trigger trg_audit_checklists after insert or update or delete on public.checklists
  for each row execute function public.audit_acao();
drop trigger if exists trg_audit_daily on public.daily_registers;
create trigger trg_audit_daily after insert or update or delete on public.daily_registers
  for each row execute function public.audit_acao();

-- -----------------------------------------------------------------------------
-- 5. ÍNDICES
-- -----------------------------------------------------------------------------
create index if not exists idx_usuarios_turma on public.usuarios (turma_id);
create index if not exists idx_equipe_membros_equipe on public.equipe_membros (equipe_id);
create index if not exists idx_equipe_membros_aluno  on public.equipe_membros (aluno_id);
create index if not exists idx_projeto_equipes_projeto on public.projeto_equipes (projeto_id);
create index if not exists idx_projeto_equipes_equipe  on public.projeto_equipes (equipe_id);
create index if not exists idx_tarefas_projeto on public.tarefas (projeto_id);
create index if not exists idx_tarefas_equipe  on public.tarefas (equipe_id);
create index if not exists idx_tarefas_aluno   on public.tarefas (aluno_id);
create index if not exists idx_tarefas_status  on public.tarefas (status, posicao);
create index if not exists idx_checklists_tarefa on public.checklists (tarefa_id);
create index if not exists idx_historico_usuario on public.historico_atividades (usuario_id);
create index if not exists idx_historico_tarefa  on public.historico_atividades (tarefa_id);
create index if not exists idx_daily_aluno_data on public.daily_registers (aluno_id, data_checkin);
create index if not exists idx_historico_acoes_tabela on public.historico_acoes (nome_tabela, registro_id);

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) E POLÍTICAS
--    Regras baseadas em permissions.js: professor/gestor administra;
--    aluno acessa apenas o que pertence à própria equipe (equipeDoAluno).
-- -----------------------------------------------------------------------------
alter table public.turmas           enable row level security;
alter table public.usuarios         enable row level security;
alter table public.equipes          enable row level security;
alter table public.equipe_membros   enable row level security;
alter table public.projetos         enable row level security;
alter table public.projeto_equipes  enable row level security;
alter table public.tarefas          enable row level security;
alter table public.checklists       enable row level security;
alter table public.historico_atividades enable row level security;
alter table public.daily_registers  enable row level security;
alter table public.historico_acoes  enable row level security;

-- helper: papel do usuário autenticado
create or replace function public.usuario_papel()
returns public.user_papel language sql stable security definer set search_path = public
as $$
  select papel from public.usuarios where id = auth.uid();
$$;

create or replace function public.is_professor()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.usuario_papel() in ('gestor', 'professor');
$$;

-- helper: equipe(s) do aluno autenticado
create or replace function public.equipes_do_uid(uid uuid default auth.uid())
returns setof uuid language sql stable security definer set search_path = public
as $$
  select em.equipe_id from public.equipe_membros em where em.aluno_id = uid;
$$;

-- -------- TURMAS --------
drop policy if exists "turmas_select_authenticated" on public.turmas;
create policy "turmas_select_authenticated" on public.turmas
  for select to authenticated using (true);
drop policy if exists "turmas_manage_professor" on public.turmas;
create policy "turmas_manage_professor" on public.turmas
  for all to authenticated using (public.is_professor()) with check (public.is_professor());

-- -------- USUÁRIOS --------
drop policy if exists "usuarios_select_authenticated" on public.usuarios;
create policy "usuarios_select_authenticated" on public.usuarios
  for select to authenticated using (true);
drop policy if exists "usuarios_update_own_or_professor" on public.usuarios;
create policy "usuarios_update_own_or_professor" on public.usuarios
  for update to authenticated
  using (id = auth.uid() or public.is_professor())
  with check (id = auth.uid() or public.is_professor());
drop policy if exists "usuarios_insert_professor" on public.usuarios;
create policy "usuarios_insert_professor" on public.usuarios
  for insert to authenticated with check (public.is_professor());
drop policy if exists "usuarios_delete_professor" on public.usuarios;
create policy "usuarios_delete_professor" on public.usuarios
  for delete to authenticated using (public.is_professor());

-- -------- EQUIPES --------
drop policy if exists "equipes_select_authenticated" on public.equipes;
create policy "equipes_select_authenticated" on public.equipes
  for select to authenticated using (true);
drop policy if exists "equipes_insert_professor" on public.equipes;
create policy "equipes_insert_professor" on public.equipes
  for insert to authenticated with check (public.is_professor());
drop policy if exists "equipes_update_member_or_professor" on public.equipes;
create policy "equipes_update_member_or_professor" on public.equipes
  for update to authenticated
  using (public.is_professor() or (select 1 from public.equipe_membros em where em.equipe_id = id and em.aluno_id = auth.uid()) is not null)
  with check (public.is_professor() or (select 1 from public.equipe_membros em where em.equipe_id = id and em.aluno_id = auth.uid()) is not null);
drop policy if exists "equipes_delete_professor" on public.equipes;
create policy "equipes_delete_professor" on public.equipes
  for delete to authenticated using (public.is_professor());

-- -------- EQUIPE_MEMBROS --------
drop policy if exists "equipe_membros_select_authenticated" on public.equipe_membros;
create policy "equipe_membros_select_authenticated" on public.equipe_membros
  for select to authenticated using (true);
drop policy if exists "equipe_membros_insert_professor" on public.equipe_membros;
create policy "equipe_membros_insert_professor" on public.equipe_membros
  for insert to authenticated with check (public.is_professor());
drop policy if exists "equipe_membros_delete_professor" on public.equipe_membros;
create policy "equipe_membros_delete_professor" on public.equipe_membros
  for delete to authenticated using (public.is_professor());

-- -------- PROJETOS --------
drop policy if exists "projetos_select_own_team_or_professor" on public.projetos;
create policy "projetos_select_own_team_or_professor" on public.projetos
  for select to authenticated
  using (
    public.is_professor()
    or exists (
      select 1 from public.projeto_equipes pe
      where pe.projeto_id = id
        and pe.equipe_id in (select public.equipes_do_uid())
    )
  );
drop policy if exists "projetos_insert_professor" on public.projetos;
create policy "projetos_insert_professor" on public.projetos
  for insert to authenticated with check (public.is_professor());
drop policy if exists "projetos_update_professor" on public.projetos;
create policy "projetos_update_professor" on public.projetos
  for update to authenticated using (public.is_professor()) with check (public.is_professor());
drop policy if exists "projetos_delete_professor" on public.projetos;
create policy "projetos_delete_professor" on public.projetos
  for delete to authenticated using (public.is_professor());

-- -------- PROJETO_EQUIPES --------
drop policy if exists "projeto_equipes_select_own_team_or_professor" on public.projeto_equipes;
create policy "projeto_equipes_select_own_team_or_professor" on public.projeto_equipes
  for select to authenticated
  using (public.is_professor() or equipe_id in (select public.equipes_do_uid()));
drop policy if exists "projeto_equipes_manage_professor" on public.projeto_equipes;
create policy "projeto_equipes_manage_professor" on public.projeto_equipes
  for all to authenticated using (public.is_professor()) with check (public.is_professor());

-- -------- TAREFAS --------
drop policy if exists "tarefas_select_own_team_or_professor" on public.tarefas;
create policy "tarefas_select_own_team_or_professor" on public.tarefas
  for select to authenticated
  using (public.is_professor() or equipe_id in (select public.equipes_do_uid()));
drop policy if exists "tarefas_insert_professor" on public.tarefas;
create policy "tarefas_insert_professor" on public.tarefas
  for insert to authenticated with check (public.is_professor());
drop policy if exists "tarefas_update_team_or_professor" on public.tarefas;
create policy "tarefas_update_team_or_professor" on public.tarefas
  for update to authenticated
  using (public.is_professor() or equipe_id in (select public.equipes_do_uid()))
  with check (public.is_professor() or equipe_id in (select public.equipes_do_uid()));
drop policy if exists "tarefas_delete_professor" on public.tarefas;
create policy "tarefas_delete_professor" on public.tarefas
  for delete to authenticated using (public.is_professor());

-- -------- CHECKLISTS --------
drop policy if exists "checklists_select_own_team_or_professor" on public.checklists;
create policy "checklists_select_own_team_or_professor" on public.checklists
  for select to authenticated
  using (
    public.is_professor()
    or (select 1 from public.tarefas t where t.id = tarefa_id and t.equipe_id in (select public.equipes_do_uid())) is not null
  );
drop policy if exists "checklists_manage_team_or_professor" on public.checklists;
create policy "checklists_manage_team_or_professor" on public.checklists
  for all to authenticated
  using (
    public.is_professor()
    or (select 1 from public.tarefas t where t.id = tarefa_id and t.equipe_id in (select public.equipes_do_uid())) is not null
  )
  with check (
    public.is_professor()
    or (select 1 from public.tarefas t where t.id = tarefa_id and t.equipe_id in (select public.equipes_do_uid())) is not null
  );

-- -------- HISTORICO_ATIVIDADES --------
drop policy if exists "historico_select_own_team_or_professor" on public.historico_atividades;
create policy "historico_select_own_team_or_professor" on public.historico_atividades
  for select to authenticated
  using (
    public.is_professor()
    or usuario_id = auth.uid()
    or (
      select 1 from public.tarefas t where t.id = tarefa_id and t.equipe_id in (select public.equipes_do_uid())
    ) is not null
  );
drop policy if exists "historico_insert_authenticated" on public.historico_atividades;
create policy "historico_insert_authenticated" on public.historico_atividades
  for insert to authenticated with check (usuario_id = auth.uid() or public.is_professor());
drop policy if exists "historico_delete_professor" on public.historico_atividades;
create policy "historico_delete_professor" on public.historico_atividades
  for delete to authenticated using (public.is_professor());

-- -------- DAILY_REGISTERS --------
drop policy if exists "daily_select_own_team_or_professor" on public.daily_registers;
create policy "daily_select_own_team_or_professor" on public.daily_registers
  for select to authenticated
  using (
    public.is_professor()
    or aluno_id = auth.uid()
    or equipe_id in (select public.equipes_do_uid())
  );
drop policy if exists "daily_insert_own" on public.daily_registers;
create policy "daily_insert_own" on public.daily_registers
  for insert to authenticated with check (aluno_id = auth.uid());
drop policy if exists "daily_update_own_or_professor" on public.daily_registers;
create policy "daily_update_own_or_professor" on public.daily_registers
  for update to authenticated
  using (aluno_id = auth.uid() or public.is_professor())
  with check (aluno_id = auth.uid() or public.is_professor());
drop policy if exists "daily_delete_professor" on public.daily_registers;
create policy "daily_delete_professor" on public.daily_registers
  for delete to authenticated using (public.is_professor());

-- -------- HISTORICO_ACOES (auditoria - somente leitura p/ autenticados) -----
drop policy if exists "historico_acoes_select_authenticated" on public.historico_acoes;
create policy "historico_acoes_select_authenticated" on public.historico_acoes
  for select to authenticated using (true);
drop policy if exists "historico_acoes_no_user_write" on public.historico_acoes;
create policy "historico_acoes_no_user_write" on public.historico_acoes
  for all to authenticated using (false) with check (false);

-- -----------------------------------------------------------------------------
-- 7. GRANT PADRÃO (consumo via API anônima/key)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;