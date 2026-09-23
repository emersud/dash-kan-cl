-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0002: SEED (POVOAMENTO DE TESTE)
-- -------------------------------------------------------------
-- Dados fiéis ao mockData.js (Fases 1–11). IDs determinísticos p/ rastreabilidade.
--
-- COBERTURA DE TELAS (complementação mínima do plano "SEED COMPLETO" 2026-09-21):
--   * +2 tarefas 'backlog' SEM aluno atribuído (uma por equipe) -> alimenta a
--     seção "Backlog Disponível" do Perfil (itens assumíveis por todos).
--   * +3 daily_registers (u3, u6, u7) -> visão do professor cobre TODOS os
--     alunos das duas equipes.
--   * +7 historico_atividades (0011..0017) -> cobre alunos sem histórico
--     (u6, u7) e exercita os tipos do enum ainda não usados:
--     'assumiu_tarefa' (u5) e 'aprovou_conclusao' (u1 - professor).
--     Resultado: Radar de Engajamento preenchido para todos.
--   * Remove o usuário residual de diagnóstico 'teste.diag@exemplo.com'.
--
-- IMPORTANTE (correção 2026-09-21):
--   O seed NÃO depende mais exclusivamente do trigger on_auth_user_created:
--   1) A Seção 0 remove qualquer resto de execução anterior (idempotente);
--   2) Após inserir em auth.users, uma "rede de segurança" insere os perfis
--      em public.usuarios lendo diretamente de auth.users (funciona mesmo se
--      o trigger não existir ou se o insert em auth.users for ignorado).
--   Ordem obrigatória: turmas -> auth.users -> auth.identities -> usuarios ->
--   demais tabelas.
--
-- CONTADORES ESPERADOS (Seção 10): auth_users=7, identities=7, usuarios=7,
--   turmas=3, equipes=2, equipe_membros=6, projetos=2, tarefas=12,
--   checklists=14, historico_atividades=17, daily_registers=8.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. LIMPEZA IDEMPOTENTE (remove restos de execuções anteriores do seed)
-- -----------------------------------------------------------------------------
-- Usuário residual de diagnóstico (criado via API nos testes de conexão;
-- caso contrário aparece na lista de alunos) + os 7 usuários do seed.
-- Apagar do Auth apaga em cascata: usuarios, equipe_membros, daily_registers
-- e historico_atividades (FKs on delete cascade).
delete from auth.users
where email in (
  'carlos@escola.com', 'joao@aluno.com', 'maria@aluno.com', 'pedro@aluno.com',
  'lucas@aluno.com', 'ana@aluno.com', 'bruno@aluno.com',
  'teste.diag@exemplo.com'
);

-- Registros com IDs determinísticos que podem sobrar de versões antigas do
-- seed (checklists caem em cascata via tarefas, mas o delete explícito garante
-- idempotência mesmo com FKs alteradas em tentativas anteriores).
delete from public.checklists
where id between '99999999-0000-4000-8000-000000000001'
             and '99999999-0000-4000-8000-000000000014';

delete from public.tarefas
where id between '88888888-0000-4000-8000-000000000001'
             and '88888888-0000-4000-8000-000000000012';

delete from public.historico_atividades
where id between 'aaaaaaaa-0000-4000-8000-000000000001'
             and 'aaaaaaaa-0000-4000-8000-000000000017';

delete from public.daily_registers
where id between 'bbbbbbbb-0000-4000-8000-000000000001'
             and 'bbbbbbbb-0000-4000-8000-000000000008';

delete from public.projeto_equipes
where projeto_id in (
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777'
);

delete from public.projetos
where id in (
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777'
);

delete from public.equipe_membros
where equipe_id in (
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-5555-8555-555555555555'
);

delete from public.equipes
where id in (
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-5555-8555-555555555555'
);

delete from public.turmas
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

-- -----------------------------------------------------------------------------
-- 1. TURMAS
-- -----------------------------------------------------------------------------
insert into public.turmas (id, nome, codigo_acesso, cor_hex) values
  ('11111111-1111-4111-8111-111111111111', '1C - Informática',      'INF1C', '#4f46e5'),
  ('22222222-2222-4222-8222-222222222222', '2C - Desenvolvimento',  'DEV2C', '#0891b2'),
  ('33333333-3333-4333-8333-333333333333', '3C - Multimídia',       'MUL3C', '#16a34a')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. USUÁRIOS (Supabase Auth -> dispara trigger handle_new_user)
--    ATENÇÃO: instance_id é OBRIGATÓRIO - sem ele, o GoTrue não encontra o
--    usuário no login por senha ("Invalid login credentials").
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'carlos@escola.com', crypt('123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Prof. Carlos","papel":"professor","funcao_principal":"Professor","avatar_url":"https://i.pravatar.cc/150?u=u1"}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'joao@aluno.com', crypt('Mudar123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"João Silva","papel":"aluno","turma_id":"11111111-1111-4111-8111-111111111111","primeiro_acesso":true,"avatar_url":"https://i.pravatar.cc/150?u=u2"}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'maria@aluno.com', crypt('Mudar123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Maria Santos","papel":"aluno","turma_id":"11111111-1111-4111-8111-111111111111","primeiro_acesso":false,"avatar_url":"https://i.pravatar.cc/150?u=u3"}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pedro@aluno.com', crypt('Mudar123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Pedro Lima","papel":"aluno","turma_id":"22222222-2222-4222-8222-222222222222","primeiro_acesso":true,"avatar_url":"https://i.pravatar.cc/150?u=u4"}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'lucas@aluno.com', crypt('Mudar123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Lucas Souza","papel":"aluno","turma_id":"22222222-2222-4222-8222-222222222222","primeiro_acesso":false,"avatar_url":"https://i.pravatar.cc/150?u=u5"}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'ana@aluno.com', crypt('Mudar123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Ana Costa","papel":"aluno","turma_id":"33333333-3333-4333-8333-333333333333","primeiro_acesso":false,"avatar_url":"https://i.pravatar.cc/150?u=u6"}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'bruno@aluno.com', crypt('Mudar123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Bruno Rocha","papel":"aluno","turma_id":"33333333-3333-4333-8333-333333333333","primeiro_acesso":true,"avatar_url":"https://i.pravatar.cc/150?u=u7"}',
   now(), now())
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. IDENTIDADES DE LOGIN (auth.identities) - OBRIGATÓRIO nas versões atuais
--    do Supabase/GoTrue: sem uma identidade do provider 'email', o login por
--    senha retorna "Invalid login credentials" MESMO com o usuário em
--    auth.users e e-mail confirmado.
-- -----------------------------------------------------------------------------
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '{"sub":"00000000-0000-4000-8000-000000000001","email":"carlos@escola.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '{"sub":"00000000-0000-4000-8000-000000000002","email":"joao@aluno.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '{"sub":"00000000-0000-4000-8000-000000000003","email":"maria@aluno.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '{"sub":"00000000-0000-4000-8000-000000000004","email":"pedro@aluno.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', '{"sub":"00000000-0000-4000-8000-000000000005","email":"lucas@aluno.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '{"sub":"00000000-0000-4000-8000-000000000006","email":"ana@aluno.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', '{"sub":"00000000-0000-4000-8000-000000000007","email":"bruno@aluno.com","email_verified":true,"phone_verified":false}', 'email', now(), now(), now())
on conflict (id) do nothing;

-- Blindagem: garante instance_id mesmo se o insert acima for ignorado (reexecução)
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000'
where instance_id is null
  and email in (
    'carlos@escola.com', 'joao@aluno.com', 'maria@aluno.com', 'pedro@aluno.com',
    'lucas@aluno.com', 'ana@aluno.com', 'bruno@aluno.com'
  );

-- Blindagem 2: o GoTrue v2 usa string vazia ('') e não NULL nas colunas de
-- token; NULL causa "Database error querying schema" no login. Normaliza.
do $$
declare
  col text;
  colunas text[] := array[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ];
begin
  foreach col in array colunas loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = col
    ) then
      execute format('update auth.users set %I = '''' where %I is null', col, col);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 4. PERFIS (REDE DE SEGURANÇA - independente do trigger on_auth_user_created)
--     Lê os usuários recém-criados do Auth e garante o perfil em public.usuarios.
--     Se o trigger já tiver criado, o "on conflict (id) do nothing" ignora.
-- -----------------------------------------------------------------------------
insert into public.usuarios (id, nome, email, papel, funcao_principal, avatar_url, turma_id, primeiro_acesso)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nome', split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.raw_user_meta_data ->> 'papel', 'aluno')::public.user_papel,
  u.raw_user_meta_data ->> 'funcao_principal',
  u.raw_user_meta_data ->> 'avatar_url',
  nullif(u.raw_user_meta_data ->> 'turma_id', '')::uuid,
  coalesce((u.raw_user_meta_data ->> 'primeiro_acesso')::boolean, true)
from auth.users u
where u.email in (
  'carlos@escola.com', 'joao@aluno.com', 'maria@aluno.com', 'pedro@aluno.com',
  'lucas@aluno.com', 'ana@aluno.com', 'bruno@aluno.com'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. EQUIPES
-- -----------------------------------------------------------------------------
insert into public.equipes (id, nome, logo_url, github_url, cor_hex) values
  ('44444444-4444-4444-8444-444444444444', 'Alpha Tech', 'https://api.dicebear.com/7.x/identicon/svg?seed=Alpha', 'https://github.com/alphatech/projeto-biblioteca', '#4f46e5'),
  ('55555555-5555-5555-8555-555555555555', 'Code Wave',  'https://api.dicebear.com/7.x/identicon/svg?seed=Wave',  'https://github.com/codewave/portal-biblioteca', '#0891b2')
on conflict (id) do nothing;

-- EQUIPE_MEMBROS (mix multi-turma, Fase 3)
insert into public.equipe_membros (equipe_id, aluno_id, papel_no_grupo) values
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', 'Líder / Backend'),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000004', 'Frontend'),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000006', 'QA'),
  ('55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000003', 'Full Stack'),
  ('55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000005', 'UI/UX Designer'),
  ('55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000007', 'Backend')
on conflict (equipe_id, aluno_id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. PROJETOS
-- -----------------------------------------------------------------------------
insert into public.projetos (id, nome, descricao, data_inicio, data_entrega, recursos, status) values
  ('66666666-6666-4666-8666-666666666666', 'Sistema de Gestão de Biblioteca', 'Desenvolvimento do portal web para empréstimos de livros.', '2026-09-01', '2026-11-30', 'Figma: bit.ly/biblioteca-figma | Docs: bit.ly/biblioteca-docs', 'em_andamento'),
  ('77777777-7777-4777-8777-777777777777', 'App de Feedback Escolar', 'Plataforma para avaliação contínua de disciplinas e professores.', '2026-09-15', '2026-12-15', 'Repositório: github.com/school/feedback-app', 'em_andamento')
on conflict (id) do nothing;

-- PROJETO_EQUIPES
insert into public.projeto_equipes (projeto_id, equipe_id) values
  ('66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444'),
  ('66666666-6666-4666-8666-666666666666', '55555555-5555-5555-8555-555555555555'),
  ('77777777-7777-4777-8777-777777777777', '44444444-4444-4444-8444-444444444444')
on conflict (projeto_id, equipe_id) do nothing;

-- -----------------------------------------------------------------------------
-- 7. TAREFAS (backlog/kanban)
--    12 tarefas: 10 fiéis ao mock + 2 em 'backlog' SEM aluno atribuído
--    (0011 Alpha / 0012 Code Wave) p/ alimentar "Backlog Disponível" do Perfil.
-- -----------------------------------------------------------------------------
insert into public.tarefas (id, projeto_id, equipe_id, aluno_id, titulo, descricao, prioridade, estimativa, status, posicao, prazo_limite, is_impedida, aguardando_validacao) values
  ('88888888-0000-4000-8000-000000000001', '66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', 'Modelagem do Banco de Dados', 'Criar script SQL e diagramas ER no Supabase', 'alta', '8', 'concluido', 1000, '2026-10-15T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000004', 'Tela de Login em React', 'Desenvolver formulário Bootstrap com integração de contexto', 'urgente', '5', 'fazendo', 2000, '2026-10-20T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000003', 'API de Cadastro de Livros', 'Integrar rotas de CRUD', 'media', '5', 'a_fazer', 1000, '2026-09-10T23:59:00Z', true, false),
  ('88888888-0000-4000-8000-000000000004', '66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000006', 'Testes de Integração', 'Cobertura das rotas de empréstimo e devolução', 'baixa', '3', 'concluido', 1000, '2026-10-05T23:59:00Z', false, true),
  ('88888888-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', 'Prototipação das telas do app', 'Wireframes de alta fidelidade para o app de feedback', 'alta', '3', 'fazendo', 2000, '2026-10-25T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000006', '66666666-6666-4666-8666-666666666666', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000005', 'Design System e Tokens', 'Paleta de cores e componentes visuais reutilizáveis', 'media', '2', 'concluido', 1000, '2026-09-28T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000007', '66666666-6666-4666-8666-666666666666', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000007', 'Integrar Autenticação JWT', 'Middleware de sessão para o portal', 'alta', '8', 'a_fazer', 1500, '2026-10-30T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000008', '77777777-7777-4777-8777-777777777777', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000004', 'Consumo da API de avaliações', 'Ligar o frontend às rotas de respostas', 'media', '5', 'a_fazer', 1000, '2026-11-05T23:59:00Z', true, false),
  ('88888888-0000-4000-8000-000000000009', '66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', 'Criar formulário de check-in no Daily Register', 'Tela de registro diário com validação de 280 caracteres', 'media', '3', 'backlog', 1000, '2026-11-10T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000010', '66666666-6666-4666-8666-666666666666', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000005', 'Definir política de prioridades do backlog', 'Critérios de priorização para as sprints', 'baixa', '1', 'backlog', 1000, '2026-11-20T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000011', '66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', null, 'Documentação da API de empréstimos', 'Escrever a documentação OpenAPI das rotas de empréstimo', 'media', '2', 'backlog', 2000, '2026-11-15T23:59:00Z', false, false),
  ('88888888-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666', '55555555-5555-5555-8555-555555555555', null, 'Testes E2E do fluxo de login', 'Criar cenários automatizados de ponta a ponta', 'alta', '5', 'backlog', 2000, '2026-11-18T23:59:00Z', false, false)
on conflict (id) do nothing;

-- CHECKLISTS (14 = 12 fiéis ao mock + 2 das novas tarefas de backlog)
insert into public.checklists (id, tarefa_id, item, concluido) values
  ('99999999-0000-4000-8000-000000000001', '88888888-0000-4000-8000-000000000001', 'Criar tabelas', true),
  ('99999999-0000-4000-8000-000000000002', '88888888-0000-4000-8000-000000000001', 'Diagrama ER', true),
  ('99999999-0000-4000-8000-000000000003', '88888888-0000-4000-8000-000000000002', 'Layout Bootstrap', true),
  ('99999999-0000-4000-8000-000000000004', '88888888-0000-4000-8000-000000000002', 'Integrar contexto', false),
  ('99999999-0000-4000-8000-000000000005', '88888888-0000-4000-8000-000000000004', 'Cenários de empréstimo', true),
  ('99999999-0000-4000-8000-000000000006', '88888888-0000-4000-8000-000000000004', 'Relatório de cobertura', false),
  ('99999999-0000-4000-8000-000000000007', '88888888-0000-4000-8000-000000000005', 'Fluxo de login', true),
  ('99999999-0000-4000-8000-000000000008', '88888888-0000-4000-8000-000000000005', 'Formulário de avaliação', false),
  ('99999999-0000-4000-8000-000000000009', '88888888-0000-4000-8000-000000000006', 'Tokens de cor', true),
  ('99999999-0000-4000-8000-000000000010', '88888888-0000-4000-8000-000000000006', 'Componentes base', true),
  ('99999999-0000-4000-8000-000000000011', '88888888-0000-4000-8000-000000000009', 'Validar limite de 280 caracteres', false),
  ('99999999-0000-4000-8000-000000000012', '88888888-0000-4000-8000-000000000009', 'Salvar data atual automaticamente', false),
  ('99999999-0000-4000-8000-000000000013', '88888888-0000-4000-8000-000000000011', 'Definir o esquema OpenAPI', false),
  ('99999999-0000-4000-8000-000000000014', '88888888-0000-4000-8000-000000000012', 'Configurar ambiente de testes E2E', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 8. HISTORICO_ATIVIDADES (17 = 10 fiéis ao mock + 7 de cobertura)
--    Cobertura: alunos u6/u7 sem histórico, tipos 'assumiu_tarefa' (u5) e
--    'aprovou_conclusao' (u1 - professor) -> Radar preenchido p/ todos.
-- -----------------------------------------------------------------------------
insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao, descricao, data_hora) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '88888888-0000-4000-8000-000000000001', 'daily_checkin', 'Check-in diário', '2026-09-14T09:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '88888888-0000-4000-8000-000000000001', 'concluiu_checklist', 'Concluiu "Criar tabelas"', '2026-09-13T10:30:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '88888888-0000-4000-8000-000000000001', 'movimentou_card', 'Concluiu a tarefa Modelagem do Banco', '2026-09-12T14:30:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '88888888-0000-4000-8000-000000000002', 'comentou', 'Iniciou a codificação da tela de Login', '2026-09-13T09:15:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', '88888888-0000-4000-8000-000000000002', 'daily_checkin', 'Check-in diário', '2026-09-14T08:45:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', '88888888-0000-4000-8000-000000000006', 'concluiu_checklist', 'Concluiu "Tokens de cor"', '2026-09-11T16:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000005', '88888888-0000-4000-8000-000000000006', 'daily_checkin', 'Check-in diário', '2026-09-13T10:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000006', '88888888-0000-4000-8000-000000000004', 'comentou', 'Relatório de cobertura em andamento', '2026-09-12T11:20:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000003', '88888888-0000-4000-8000-000000000003', 'bloqueou', 'Tarefa impedida aguardando suporte', '2026-09-08T15:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002', '88888888-0000-4000-8000-000000000005', 'daily_checkin', 'Check-in diário', '2026-09-15T09:10:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000006', '88888888-0000-4000-8000-000000000004', 'concluiu_checklist', 'Concluiu "Cenários de empréstimo"', '2026-09-14T13:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000006', '88888888-0000-4000-8000-000000000004', 'daily_checkin', 'Check-in diário', '2026-09-15T08:30:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000007', '88888888-0000-4000-8000-000000000007', 'comentou', 'Começando a análise do middleware JWT', '2026-09-14T10:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000007', '88888888-0000-4000-8000-000000000007', 'daily_checkin', 'Check-in diário', '2026-09-15T09:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000005', '88888888-0000-4000-8000-000000000010', 'assumiu_tarefa', 'Assumiu a tarefa "Definir política de prioridades do backlog"', '2026-09-13T14:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000001', '88888888-0000-4000-8000-000000000001', 'aprovou_conclusao', 'Aprovou a conclusão de "Modelagem do Banco de Dados"', '2026-09-15T16:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000007', '88888888-0000-4000-8000-000000000007', 'movimentou_card', 'Moveu "Integrar Autenticação JWT" para "A Fazer"', '2026-09-14T11:30:00Z')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 9. DAILY_REGISTERS (8 = 5 fiéis ao mock + 3 de cobertura: u3, u6, u7)
-- -----------------------------------------------------------------------------
insert into public.daily_registers (id, equipe_id, aluno_id, data_checkin, o_que_fez, licao_aprendida, impedimento) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', '2026-09-13', 'Finalizei a modelagem do banco de dados.', 'Aprendi a tratar RLS no Supabase.', ''),
  ('bbbbbbbb-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', '2026-09-14', 'Iniciei o protótipo das telas do app.', 'Prototipagem acelera a validação.', ''),
  ('bbbbbbbb-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000002', '2026-09-15', 'Configurei as rotas do React.', 'Mocks ajudam no desenvolvimento independente do back.', 'Aguardando design system.'),
  ('bbbbbbbb-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000004', '2026-09-15', 'Desenvolvi a tela de login.', 'Importante manter checklists pequenas.', ''),
  ('bbbbbbbb-0000-4000-8000-000000000005', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000005', '2026-09-14', 'Criei o design system da equipe.', 'Tokens de cor facilitam o tema.', ''),
  ('bbbbbbbb-0000-4000-8000-000000000006', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000003', '2026-09-15', 'Ajustei as rotas de cadastro de livros.', 'Validar a entrada cedo evita retrabalho.', 'Aguardando revisão do professor.'),
  ('bbbbbbbb-0000-4000-8000-000000000007', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000006', '2026-09-15', 'Rodei os testes de integração das rotas.', 'Cobertura de testes dá segurança para refatorar.', ''),
  ('bbbbbbbb-0000-4000-8000-000000000008', '55555555-5555-5555-8555-555555555555', '00000000-0000-4000-8000-000000000007', '2026-09-15', 'Estudei o fluxo de autenticação JWT.', 'Middleware centraliza a segurança.', '')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 10. VERIFICAÇÃO FINAL (resultado esperado exibido ao final da execução)
-- -----------------------------------------------------------------------------
select
  (select count(*) from auth.users where email in (
     'carlos@escola.com', 'joao@aluno.com', 'maria@aluno.com', 'pedro@aluno.com',
     'lucas@aluno.com', 'ana@aluno.com', 'bruno@aluno.com'
   )) as auth_users,
  (select count(*) from auth.identities where user_id in (
     '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
     '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
     '00000000-0000-4000-8000-000000000007'
   )) as identities,
  (select count(*) from public.usuarios) as usuarios,
  (select count(*) from public.turmas) as turmas,
  (select count(*) from public.equipes) as equipes,
  (select count(*) from public.equipe_membros) as equipe_membros,
  (select count(*) from public.projetos) as projetos,
  (select count(*) from public.tarefas) as tarefas,
  (select count(*) from public.checklists) as checklists,
  (select count(*) from public.historico_atividades) as historico_atividades,
  (select count(*) from public.daily_registers) as daily_registers;
-- Esperado: auth_users=7, identities=7, usuarios=7, turmas=3, equipes=2,
--           equipe_membros=6, projetos=2, tarefas=12, checklists=14,
--           historico_atividades=17, daily_registers=8
