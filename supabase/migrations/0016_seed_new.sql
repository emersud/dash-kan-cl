-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0016: SEED_NEW (BASE COMPLETA DE TESTE)
-- -----------------------------------------------------------------------------
-- Povoa o sistema com DADOS SUFICIENTES PARA EXERCITAR TODAS AS TELAS:
--
--   * 2 turmas .............. 50 alunos (1..25 turma A, 26..50 turma B)
--   * 12 equipes ............ 60 vínculos; 10 alunos em 2 equipes ao mesmo
--                             tempo; TODAS as equipes com alunos das DUAS turmas
--   * 6 projetos ............ 24 vínculos equipe<->projeto; CADA equipe em 2
--                             projetos e CADA projeto com 4 equipes
--   * ~300 tarefas .......... >= 12 por projeto (na pratica ~48), nos 4 status
--                             do kanban, com prioridade/estimativa/prazo,
--                             tarefas atrasadas, impedidas e aguardando
--                             validação do professor; ~12 SEM aluno (backlog
--                             disponível no Perfil)
--                             Cada aluno recebe entre 4 e 9 tarefas em STATUS
--                             DIFERENTES (5 perfis de "estágio" distintos)
--   * checklists ............ 4 itens por tarefa, com itens concluídos conforme
--                             o estágio da tarefa
--   * daily_registers ....... TODOS os alunos com 3 a 6 check-ins (>= 3 exigido)
--   * historico_atividades .. os 7 tipos do enum (daily_checkin,
--                             concluiu_checklist, movimentou_card, comentou,
--                             bloqueou, assumiu_tarefa, aprovou_conclusao)
--   * avaliacoes_periodos ... Sprint 1 (encerrado), Sprint 2 (aberto),
--                             Sprint 3 (rascunho, sem avaliações)
--   * peer_avaliacoes ........ TODOS os alunos avaliados por TODOS os colegas
--                             de equipe nos Sprints 1 e 2 (par completo), com
--                             comentários em ~50% e rascunhos no Sprint 2
--   * Radar de Engajamento .. 5 perfis calibrados para produzir as 4 situações
--                             do engagementRadar.js: Protagônico / Boa
--                             Participação / Atenção / Crítica
--
-- USUÁRIOS CRIADOS (login por e-mail + senha, Supabase Auth):
--   Gestor / administrador:  admin@escola.com        / 123456
--   Professores:             carlos@escola.com       / 123456
--                            beatriz@escola.com      / 123456
--   Alunos (50):             aluno01@demo.com ... aluno50@demo.com / Mudar123
--
-- IDEMPOTENTE: no início a 0016 apaga SOMENTE os dados que ela própria cria
--   (e-mails @demo.com + staff acima, equipes/projetos abaixo, períodos
--   "Sprint 1/2/3"). Rodar duas vezes não duplica nada.
--   Fluxo recomendado: 0015 (zerar) -> 0016 (popular).
--
-- PERMISSÕES: nada muda em RLS/policies. A escrita roda no SQL Editor como o
--   dono das tabelas (bypass de RLS). Detalhe importante: a migração 0006
--   bloqueia INSERT de tarefa 'concluida' sem validação quando NÃO é professor
--   (auth.uid() nulo = "aluno"). Por isso o script assume a sessão JWT do
--   Prof. Carlos durante a escrita e a LIMPA antes das avaliações por pares
--   (a 0013 exige auth.uid() nulo para aceitar seed em período encerrado).
--
-- COMO APLICAR: SQL Editor do Supabase -> colar este arquivo -> Run.
--   Depois confira o relatório de checagens no fim (tudo "OK").
-- =============================================================================

do $seed$
declare
  -- ---------- IDs determinísticos (atribuídos no corpo) ----------
  v_turma_a      uuid;
  v_turma_b      uuid;
  v_gestor       uuid;
  v_prof1        uuid;
  v_prof2        uuid;

  -- ---------- parâmetros gerais ----------
  v_hoje         date := current_date;
  v_i            integer; v_j integer; v_m integer; v_t integer; v_g integer;
  v_per          integer; v_a integer; v_b integer; v_n integer;
  v_perfil       integer;
  v_aluno        uuid;
  v_tarefa       uuid;
  v_aux_id       uuid;
  v_aux_txt      text;
  v_eq1          integer; v_eq2 integer;
  v_eqs          integer[];
  v_mem          integer[];
  v_lista        public.tarefa_status[];
  v_proj         integer; v_team integer; v_kproj integer;
  v_status       public.tarefa_status;
  v_n_atras      integer; v_n_imp integer; v_n_ok integer;
  v_eh_atras     boolean; v_eh_imp boolean; v_aguard boolean;
  v_prazo        timestamptz;
  v_created      timestamptz;
  v_data_ref     timestamptz;
  v_data_checkin date;
  v_titulo       text; v_desc text;
  v_prio         public.tarefa_prioridade;
  v_est          public.tarefa_estimativa;
  v_aluno_tarefas uuid[] := array[]::uuid[];
  v_imp_tasks     uuid[] := array[]::uuid[];
  v_demo_ids      uuid[] := array[]::uuid[];
  v_ult          integer;
  v_rascunho     boolean;
  v_notas        integer[] := array[3,3,3,3,3];
  v_coment_txt   text;
  v_est_av       public.peer_avaliacao_estado;
  v_cont_pos     integer[] := array_fill(0, array[6]);
  v_proj_a       integer[] := array_fill(0, array[12]);  -- projeto 1 da equipe
  v_proj_b       integer[] := array_fill(0, array[12]);  -- projeto 2 da equipe

  -- ---------- listas de apoio ----------
  v_staff_emails text[] := array['admin@escola.com', 'carlos@escola.com', 'beatriz@escola.com'];

  v_nomes text[] := array[
    'Ana Beatriz Almeida','Bruno Carvalho','Camila Duarte','Diego Ferreira','Eduarda Gomes',
    'Felipe Henrique','Gabriela Inácio','Henrique Jacques','Isabela Kopke','João Lucas Mendes',
    'Karina Nogueira','Lucas Oliveira','Mariana Pires','Nathan Queiroz','Olívia Ribeiro',
    'Paulo Siqueira','Quésia Tavares','Rafael Uchôa','Sabrina Vieira','Thiago Wanderley',
    'Úrsula Xavier','Victor Yamanaka','Yasmin Zanetti','André Moreira','Beatriz Cardoso',
    'Caio Damasceno','Débora Esteves','Emanuel Farias','Fernanda Guimarães','Gustavo Hiroshi',
    'Helena Ipanema','Igor Justen','Juliana Krause','Kevin Lombardi','Larissa Matos',
    'Mateus Nascimento','Natália Obando','Otávio Pacheco','Priscila Quintela','Rodrigo Ramalho',
    'Sofia Santana','Tomás Tavares','Ubiratã Nunes','Vitória Camargo','Wesley Dantas',
    'Yara Bittencourt','Zeca Martins','Alice Fontes','Bruno Sampaio','Clara Vasconcelos'];

  v_funcoes text[] := array['Frontend','Backend','QA','Design','Full Stack'];

  v_equipes_nomes text[] := array[
    'Fênix Code','Nebulosa Dev','Órbita Tech','Prisma Labs','Quartz Digital','Ravina Soft',
    'Sagitário Dev','Titan Byte','Úrsula Code','Vulcão Labs','Warp Dev','Zênite Code'];

  v_proj_nom text[] := array[
    'Portal Cultural Escolar','Gestão de Chamadas','Feira de Ciências Digital',
    'Biblioteca Sem Papel','Radar de Aprendizagem','Arena de Projetos'];

  v_proj_desc text[] := array[
    'Portal de eventos, cursos e acervo cultural da escola.',
    'Chamada digital com relatórios de presença por turma.',
    'Exposição online de projetos com votação do público.',
    'Acervo sem papel com empréstimos e reservas pelo app.',
    'Painel de indicadores de aprendizagem por aluno e equipe.',
    'Mercado interno de microprojetos entre as turmas.'];

  v_modulos text[] := array[
    'Autenticação','Dashboard','Kanban','Relatórios','Notificações',
    'Integrações','Banco de dados','API REST','Documentação','Testes automatizados'];

  v_acoes text[] := array[
    'Interface','Back-end','Modelagem','Validações','Cache','Implantação'];

  v_itens text[] := array[
    'Levantar requisitos','Criar componentes','Escrever testes','Atualizar documentação'];

  v_estimativas public.tarefa_estimativa[] := array['P','M','G','1','2','3','5','8']::public.tarefa_estimativa[];

  v_daily_fez text[] := array[
    'Finalizei a integração da tela com a API',
    'Corrigi os bugs apontados no code review',
    'Implementei a validação dos formulários no front',
    'Escrevi os testes do módulo de cadastro',
    'Documentei a API dos check-ins diários',
    'Ajustei o layout do kanban para telas pequenas'];

  v_daily_lic text[] := array[
    'Combinar o escopo antes de codar evita retrabalho',
    'Teste automatizado pegou regressão que o olho não viu',
    'Commits pequenos deixam o PR muito mais fácil de revisar',
    'Nomear bem a variável economiza tempo de quem lê depois',
    'Pair programming destravou a tarefa parada desde ontem',
    'Atualizar o checklist junto com o código mantém o board confiável'];

  v_daily_imp text[] := array[
    'Aguardando definição do professor sobre a regra de negócio',
    'Ambiente de homologação fora do ar pela manhã',
    'API de CEP atingiu o limite de requisições',
    'Sem acesso ao repositório de um colega da equipe'];

  v_coment text[] := array[
    'Muito boa parceria; sempre revisa o código do time.',
    'Boa comunicação nos dailys e entrega dentro do prazo.',
    'Poderia documentar melhor as decisões técnicas.',
    'Excelente trabalho no front; testou os casos de borda.',
    'Precisa compartilhar mais o andamento com a equipe.',
    'Autonomia boa, mas deixou os bloqueios para a última hora'];

  v_peer_coment text[] := array[
    'Colabora muito com a equipe e revisa os PRs.',
    'Cumpre o combinado e avisa quando algo trava.',
    'Comunicação clara nos dailys e nas reuniões.',
    'Entregas consistentes, pouco retrabalho.',
    'Poderia dividir melhor as tarefas com o grupo.',
    'Boa autonomia; falta documentar o que faz.'];

  -- ---------- perfis de engajamento (5 grupos de 10 alunos) ----------
  -- índice = (i % 5) + 1  ->  perfil 0 Protagônico, 1 Boa, 2 Atenção,
  --                           3 Crítica, 4 Atenção (variante)
  v_p_dailys  int[] := array[6, 6, 4, 3, 4];    -- nº de check-ins (>= 3 sempre)
  v_p_ancora  int[] := array[0, 1, 1, 9, 2];    -- dias desde o último check-in
  v_p_concl   int[] := array[5, 3, 1, 0, 2];    -- tarefas já concluídas
  v_p_atras   int[] := array[0, 1, 1, 2, 1];    -- tarefas com prazo vencido
  v_p_impedit int[] := array[0, 1, 1, 2, 1];    -- tarefas impedidas
  v_p_coment  int[] := array[10, 8, 4, 0, 5];   -- comentários no histórico
begin
  -- ===========================================================================
  -- 0) Helper de UUID determinístico (mesmo dado -> mesmo id => reuso seguro)
  -- ===========================================================================
  create or replace function public.demo_uuid_seed(p_chave text)
  returns uuid language sql immutable as
  $fn$
    select (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4) || '-' ||
      substr(h, 17, 4) || '-' || substr(h, 21, 12)
    )::uuid
    from (select md5('eduproject-demo:' || p_chave) as h) s;
  $fn$;

  v_turma_a := public.demo_uuid_seed('turma:A');
  v_turma_b := public.demo_uuid_seed('turma:B');
  v_gestor  := public.demo_uuid_seed('user:admin@escola.com');
  v_prof1   := public.demo_uuid_seed('user:carlos@escola.com');
  v_prof2   := public.demo_uuid_seed('user:beatriz@escola.com');

  -- ===========================================================================
  -- 1) SESSÃO "PROFESSOR" (migração 0006)
  --    is_professor() precisa ser true para permitir INSERT de tarefa
  --    'concluida' + aguardando_validacao = false. Sem sessão, o SQL Editor
  --    seria tratado como ALUNO e a migração lançaria exceção.
  -- ===========================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_prof1, 'role', 'authenticated', 'email', 'carlos@escola.com')::text,
    true);
  perform set_config('request.jwt.claim.sub', v_prof1::text, true);

  -- ===========================================================================
  -- 2) LIMPEZA DO QUE A 0016 JÁ CRIOU (idempotência)
  -- ===========================================================================
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(id) from public.turmas where id in (v_turma_a, v_turma_b)),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(id) from public.equipes where nome = any (v_equipes_nomes)),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(id) from public.projetos where nome = any (v_proj_nom)),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(id) from public.usuarios
      where email like '%@demo.com' or email = any (v_staff_emails)),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(id) from public.avaliacoes_periodos where nome in ('Sprint 1','Sprint 2','Sprint 3')),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(t.id) from public.tarefas t
      where t.projeto_id in (select p.id from public.projetos p where p.nome = any (v_proj_nom))),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(c.id) from public.checklists c
      where c.tarefa_id in (select id from public.tarefas
                             where projeto_id in (select p.id from public.projetos p
                                                   where p.nome = any (v_proj_nom)))),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(em.id) from public.equipe_membros em
      where em.equipe_id in (select e.id from public.equipes e where e.nome = any (v_equipes_nomes))
         or em.aluno_id in (select u.id from public.usuarios u
                             where u.email like '%@demo.com' or u.email = any (v_staff_emails))),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(pe.id) from public.projeto_equipes pe
      where pe.projeto_id in (select p.id from public.projetos p where p.nome = any (v_proj_nom))),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(d.id) from public.daily_registers d
      where d.aluno_id in (select u.id from public.usuarios u where u.email like '%@demo.com')),
    array[]::uuid[]);
  v_demo_ids := v_demo_ids || coalesce(
    (select array_agg(a.id) from public.peer_avaliacoes a
      where a.periodo_id in (select id from public.avaliacoes_periodos
                              where nome in ('Sprint 1','Sprint 2','Sprint 3'))),
    array[]::uuid[]);

  -- exclui (filhos antes dos pais)
  delete from public.peer_avaliacoes
   where periodo_id in (select id from public.avaliacoes_periodos
                         where nome in ('Sprint 1','Sprint 2','Sprint 3'));

  delete from public.avaliacoes_periodos where nome in ('Sprint 1','Sprint 2','Sprint 3');

  delete from public.checklists
   where tarefa_id in (select t.id from public.tarefas t
                        where t.projeto_id in (select p.id from public.projetos p
                                                where p.nome = any (v_proj_nom)));

  delete from public.historico_atividades
   where usuario_id in (select u.id from public.usuarios u
                         where u.email like '%@demo.com' or u.email = any (v_staff_emails))
      or tarefa_id in (select t.id from public.tarefas t
                        where t.projeto_id in (select p.id from public.projetos p
                                                where p.nome = any (v_proj_nom)));

  delete from public.daily_registers
   where aluno_id in (select u.id from public.usuarios u where u.email like '%@demo.com');

  delete from public.tarefas
   where projeto_id in (select p.id from public.projetos p where p.nome = any (v_proj_nom));

  delete from public.projeto_equipes
   where projeto_id in (select p.id from public.projetos p where p.nome = any (v_proj_nom));

  delete from public.projetos where nome = any (v_proj_nom);

  delete from public.equipe_membros
   where equipe_id in (select e.id from public.equipes e where e.nome = any (v_equipes_nomes))
      or aluno_id in (select u.id from public.usuarios u
                       where u.email like '%@demo.com' or u.email = any (v_staff_emails));

  delete from public.equipes where nome = any (v_equipes_nomes);

  delete from public.usuarios
   where email like '%@demo.com' or email = any (v_staff_emails);

  delete from public.turmas where id in (v_turma_a, v_turma_b);

  delete from auth.identities
   where user_id in (select id from auth.users
                      where email like '%@demo.com' or email = any (v_staff_emails));

  delete from auth.users
   where email like '%@demo.com' or email = any (v_staff_emails);

  -- auditoria do que foi apagado (por último: as cascatas geraram novas linhas)
  delete from public.historico_acoes where registro_id = any (v_demo_ids);

  -- ===========================================================================
  -- 3) TURMAS (2)
  -- ===========================================================================
  insert into public.turmas (id, nome, codigo_acesso, cor_hex) values
    (v_turma_a, 'Técnico em Informática — 1ª série',  'TI-A-2026', '#4f46e5'),
    (v_turma_b, 'Desenvolvimento de Sistemas — 2ª série', 'DS-B-2026', '#0891b2')
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 4) USUÁRIOS (Supabase Auth -> trigger handle_new_user cria o perfil)
  -- ===========================================================================
  -- 4.1 administrador + 2 professores
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', v_gestor, 'authenticated', 'authenticated',
     'admin@escola.com', crypt('123456', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"nome":"Marta Gomes","papel":"gestor","funcao_principal":"Administrador",
       "avatar_url":"https://i.pravatar.cc/150?u=admin","primeiro_acesso":false}'::jsonb,
     now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_prof1, 'authenticated', 'authenticated',
     'carlos@escola.com', crypt('123456', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"nome":"Prof. Carlos","papel":"professor","funcao_principal":"Professor",
       "avatar_url":"https://i.pravatar.cc/150?u=carlos","primeiro_acesso":false}'::jsonb,
     now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_prof2, 'authenticated', 'authenticated',
     'beatriz@escola.com', crypt('123456', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"nome":"Prof. Beatriz","papel":"professor","funcao_principal":"Professor",
       "avatar_url":"https://i.pravatar.cc/150?u=beatriz","primeiro_acesso":false}'::jsonb,
     now(), now())
  on conflict (id) do nothing;

  -- 4.2 50 alunos (25 por turma) — 50 perfis com nomes diferentes
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    public.demo_uuid_seed('user:aluno' || lpad(n::text, 2, '0') || '@demo.com'),
    'authenticated', 'authenticated',
    'aluno' || lpad(n::text, 2, '0') || '@demo.com',
    crypt('Mudar123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'nome', v_nomes[n],
      'papel', 'aluno',
      'funcao_principal', v_funcoes[ ((n - 1) % 5) + 1 ],
      'avatar_url', 'https://i.pravatar.cc/150?u=aluno' || lpad(n::text, 2, '0'),
      'turma_id', (case when n <= 25 then v_turma_a else v_turma_b end)::text,
      'primeiro_acesso', (n % 4 = 0)
    ),
    now(), now()
  from generate_series(1, 50) n
  on conflict (id) do nothing;

  -- 4.3 IDENTIDADES (obrigatórias: sem elas o login retorna
  --     "Invalid login credentials" mesmo com a conta em auth.users)
  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  select public.demo_uuid_seed('ident:' || u.email), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email,
                            'email_verified', true, 'phone_verified', false),
         'email', now(), now(), now()
    from auth.users u
   where (u.email like '%@demo.com' or u.email = any (v_staff_emails))
     and not exists (select 1 from auth.identities i where i.user_id = u.id)
  on conflict (id) do nothing;

  -- 4.4 Blindagem GoTrue: instance_id e colunas de token = '' (não NULL)
  update auth.users
     set instance_id = '00000000-0000-0000-0000-000000000000'
   where instance_id is null
     and (email like '%@demo.com' or email = any (v_staff_emails));

  -- normaliza colunas de token quando existem (versões do GoTrue)
  declare
    v_col   text;
    v_colunas text[] := array[
      'confirmation_token', 'recovery_token', 'email_change',
      'email_change_token_new', 'email_change_token_current',
      'phone_change', 'phone_change_token', 'reauthentication_token'];
  begin
    foreach v_col in array v_colunas loop
      if exists (select 1 from information_schema.columns
                  where table_schema = 'auth' and table_name = 'users'
                    and column_name = v_col) then
        execute format('update auth.users set %I = '''' where %I is null', v_col, v_col);
      end if;
    end loop;
  end;

  -- 4.5 Rede de segurança: garante o perfil em public.usuarios e a senha
  --     demo na coluna deprecada (o login real é feito pelo Supabase Auth)
  insert into public.usuarios (id, nome, email, senha, papel, funcao_principal,
                               avatar_url, turma_id, primeiro_acesso)
  select u.id,
         coalesce(u.raw_user_meta_data ->> 'nome', split_part(u.email, '@', 1)),
         u.email,
         case when u.email like '%@demo.com' then 'Mudar123' else '123456' end,
         coalesce(u.raw_user_meta_data ->> 'papel', 'aluno')::public.user_papel,
         u.raw_user_meta_data ->> 'funcao_principal',
         u.raw_user_meta_data ->> 'avatar_url',
         nullif(u.raw_user_meta_data ->> 'turma_id', '')::uuid,
         coalesce((u.raw_user_meta_data ->> 'primeiro_acesso')::boolean, true)
    from auth.users u
   where u.email like '%@demo.com' or u.email = any (v_staff_emails)
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 5) EQUIPES (12) e MEMBROS (60)
  --    Equipe primária de i: ((i-1) % 12) + 1
  --    Equipe secundária (i múltiplo de 5): a vizinha -> aluno em 2 equipes
  -- ===========================================================================
  for v_t in 1..12 loop
    insert into public.equipes (id, nome, logo_url, github_url, cor_hex)
    values (
      public.demo_uuid_seed('equipe:' || v_t),
      v_equipes_nomes[v_t],
      'https://api.dicebear.com/7.x/identicon/svg?seed=' || replace(v_equipes_nomes[v_t], ' ', ''),
      'https://github.com/eduproject/' || lower(replace(v_equipes_nomes[v_t], ' ', '-')),
      case when v_t <= 6 then
        case v_t when 1 then '#4f46e5' when 2 then '#0891b2' when 3 then '#16a34a'
                 when 4 then '#f59e0b' when 5 then '#ef4444' else '#8b5cf6' end
      else
        case v_t when 7 then '#4f46e5' when 8 then '#0891b2' when 9 then '#16a34a'
                 when 10 then '#f59e0b' when 11 then '#ef4444' else '#8b5cf6' end
      end)
    on conflict (id) do nothing;
  end loop;

  -- 5.1 vínculo primário (com papel no grupo por profundidade: 1º = Líder)
  insert into public.equipe_membros (id, equipe_id, aluno_id, papel_no_grupo)
  select public.demo_uuid_seed('mem:' || n || ':1'),
         public.demo_uuid_seed('equipe:' || (((n - 1) % 12) + 1)),
         public.demo_uuid_seed('user:aluno' || lpad(n::text, 2, '0') || '@demo.com'),
         case when (n - 1) / 12 = 0 then 'Líder'
              when (n - 1) / 12 = 1 then 'Dev Backend'
              when (n - 1) / 12 = 2 then 'Dev Frontend'
              when (n - 1) / 12 = 3 then 'QA'
              else 'DevOps' end
    from generate_series(1, 50) n
  on conflict (equipe_id, aluno_id) do nothing;

  -- 5.2 vínculo secundário (10 alunos em 2 equipes ao mesmo tempo)
  insert into public.equipe_membros (id, equipe_id, aluno_id, papel_no_grupo)
  select public.demo_uuid_seed('mem:' || n || ':2'),
         public.demo_uuid_seed(
           'equipe:' || (case when ((n - 1) % 12) = 11 then 1 else ((n - 1) % 12) + 2 end)),
         public.demo_uuid_seed('user:aluno' || lpad(n::text, 2, '0') || '@demo.com'),
         'Dev Full Stack'
    from generate_series(1, 50) n
   where n % 5 = 0
  on conflict (equipe_id, aluno_id) do nothing;

  -- ===========================================================================
  -- 6) PROJETOS (6) e VÍNCULOS EQUIPE<->PROJETO (24)
  --    cada equipe entra em exatamente 2 projetos; cada projeto tem 4 equipes
  -- ===========================================================================
  insert into public.projetos (id, nome, descricao, data_inicio, data_entrega,
                               recursos, status)
  select public.demo_uuid_seed('projeto:' || p),
         v_proj_nom[p],
         v_proj_desc[p],
         (case when p = 6 then v_hoje - 90 else v_hoje - (55 - p * 3) end)::date,
         (case when p = 6 then v_hoje - 7    else v_hoje + (20 + p * 6) end)::date,
         'https://github.com/eduproject/' || lower(replace(v_proj_nom[p], ' ', '-')),
         case when p = 6 then 'concluido' else 'em_andamento' end
    from generate_series(1, 6) p
  on conflict (id) do nothing;

  insert into public.projeto_equipes (id, projeto_id, equipe_id)
  select public.demo_uuid_seed('pe:' || p || ':' || ((2 * (p - 1) + o) % 12 + 1)),
         public.demo_uuid_seed('projeto:' || p),
         public.demo_uuid_seed('equipe:' || ((2 * (p - 1) + o) % 12 + 1))
    from generate_series(1, 6) p, generate_series(0, 3) o
  on conflict (projeto_id, equipe_id) do nothing;

  -- mapa equipe -> seus 2 projetos (usado na distribuição de tarefas)
  for v_t in 1..12 loop
    v_g := (v_t + 1) / 2;                       -- ceil(v_t / 2)
    if v_g = 1 then
      v_proj_a[v_t] := 1;
      v_proj_b[v_t] := 6;
    else
      v_proj_a[v_t] := v_g - 1;
      v_proj_b[v_t] := v_g;
    end if;
  end loop;

  -- ===========================================================================
  -- 7) TAREFAS (~290 atribuídas + 12 sem aluno) + CHECKLISTS + HISTÓRICO
  --    Cada aluno recebe 4..9 tarefas cobrindo STATUS DIFERENTES.
  -- ===========================================================================
  for v_i in 1..50 loop
    v_perfil := v_i % 5;
    v_aluno  := public.demo_uuid_seed('user:aluno' || lpad(v_i::text, 2, '0') || '@demo.com');
    v_eq1    := ((v_i - 1) % 12) + 1;
    v_eqs    := array[v_eq1];
    if v_i % 5 = 0 then
      v_eq2 := case when v_eq1 = 12 then 1 else v_eq1 + 1 end;
      v_eqs := v_eqs || v_eq2;
    end if;

    if v_perfil = 0 then
      v_lista := array['concluido','concluido','concluido','concluido','concluido',
                       'fazendo','fazendo','a_fazer','backlog']::public.tarefa_status[];
    elsif v_perfil = 1 then
      v_lista := array['concluido','concluido','concluido',
                       'fazendo','a_fazer','backlog']::public.tarefa_status[];
    elsif v_perfil = 2 then
      v_lista := array['concluido','fazendo','fazendo','a_fazer','backlog']::public.tarefa_status[];
    elsif v_perfil = 3 then
      v_lista := array['fazendo','a_fazer','a_fazer','backlog']::public.tarefa_status[];
    else
      v_lista := array['concluido','concluido','fazendo','a_fazer','backlog']::public.tarefa_status[];
    end if;

    -- referência de data do histórico (perfil ocioso: 9 dias atrás)
    v_data_ref      := (v_hoje - v_p_ancora[v_perfil + 1])::timestamp + interval '19 hours';
    v_aluno_tarefas := array[]::uuid[];
    v_imp_tasks     := array[]::uuid[];
    v_n_atras       := 0;
    v_n_imp         := 0;

    for v_j in 1..cardinality(v_lista) loop
      v_status := v_lista[v_j];
      v_team   := v_eqs[ ((v_j - 1) % cardinality(v_eqs)) + 1 ];
      v_proj   := case when (v_i + v_j) % 2 = 0 then v_proj_a[v_team] else v_proj_b[v_team] end;

      v_cont_pos[v_proj] := v_cont_pos[v_proj] + 1;
      v_kproj := v_cont_pos[v_proj];

      v_titulo := v_modulos[ ((v_kproj - 1) % 10) + 1 ]
                  || ' — ' ||
                  v_acoes[ (((v_kproj - 1) / 10) % 6 ) + 1 ];
      v_desc   := format('Tarefa %s do projeto "%s". Seguir o definition of done e registrar o andamento no daily.',
                         v_kproj, v_proj_nom[v_proj]);
      v_prio   := (case (v_kproj % 4) when 0 then 'baixa' when 1 then 'media'
                                      when 2 then 'alta' else 'urgente' end)::public.tarefa_prioridade;
      v_est    := v_estimativas[ ((v_kproj - 1) % 8) + 1 ];
      v_created := now() - make_interval(days => (24 - least(v_j, 18)));

      -- atrasadas/impedidas: aplicadas às tarefas ainda não concluídas
      v_eh_atras := false;
      v_eh_imp   := false;
      if v_status <> 'concluido' then
        if v_n_atras < v_p_atras[v_perfil + 1] then
          v_n_atras := v_n_atras + 1;
          v_eh_atras := true;
        end if;
        if v_n_imp < v_p_impedit[v_perfil + 1] then
          v_n_imp := v_n_imp + 1;
          v_eh_imp := true;
        end if;
      end if;

      if v_status = 'concluido' then
        v_prazo := (v_hoje + ((v_i + v_j) % 7) + 3)::timestamp + interval '22 hours';
      elsif v_eh_atras then
        v_prazo := (v_hoje - (((v_i + v_j) % 7) + 1))::timestamp + interval '22 hours';
      else
        v_prazo := (v_hoje + ((v_i + v_j) % 9) + 5)::timestamp + interval '22 hours';
      end if;

      -- última tarefa concluída do aluno fica "aguardando validação" de 1/3 dos casos
      v_aguard := (v_status = 'concluido')
                  and (v_j = v_p_concl[v_perfil + 1])
                  and (v_i % 3 = 0);

      v_tarefa := public.demo_uuid_seed('tarefa:' || v_i || ':' || v_j);

      insert into public.tarefas (id, projeto_id, equipe_id, aluno_id, titulo, descricao,
                                  prioridade, estimativa, status, posicao, prazo_limite,
                                  is_impedida, aguardando_validacao, created_at, updated_at)
      values (v_tarefa,
              public.demo_uuid_seed('projeto:' || v_proj),
              public.demo_uuid_seed('equipe:' || v_team),
              v_aluno, v_titulo, v_desc, v_prio, v_est, v_status, v_kproj * 10,
              v_prazo, v_eh_imp, v_aguard, v_created, v_created)
      on conflict (id) do nothing;

      v_aluno_tarefas := v_aluno_tarefas || v_tarefa;
      if v_eh_imp then
        v_imp_tasks := v_imp_tasks || v_tarefa;
      end if;

      -- itens concluídos conforme o estágio da tarefa
      v_n_ok := case when v_status = 'concluido' then 4
                     when v_status = 'fazendo'  then 2
                     when v_status = 'a_fazer'  then 1
                     else 0 end;

      for v_m in 1..4 loop
        insert into public.checklists (id, tarefa_id, item, concluido, created_at)
        values (public.demo_uuid_seed('chk:' || v_tarefa || ':' || v_m),
                v_tarefa, v_itens[v_m], v_m <= v_n_ok, v_created)
        on conflict (id) do nothing;
      end loop;

      for v_m in 1..v_n_ok loop
        insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                                 descricao, data_hora)
        values (public.demo_uuid_seed('hist:chk:' || v_tarefa || ':' || v_m),
                v_aluno, v_tarefa, 'concluiu_checklist',
                format('Concluiu o item "%s" da tarefa "%s"', v_itens[v_m], v_titulo),
                v_data_ref - make_interval(hours => v_m))
        on conflict (id) do nothing;
      end loop;
    end loop;

    -- ---- demais eventos do histórico do aluno ----
    for v_m in 1..v_p_coment[v_perfil + 1] loop
      insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                               descricao, data_hora)
      values (public.demo_uuid_seed('hist:cmt:' || v_i || ':' || v_m),
              v_aluno,
              v_aluno_tarefas[ ((v_m - 1) % cardinality(v_aluno_tarefas)) + 1 ],
              'comentou',
              'Comentou na tarefa: ' || v_coment[ ((v_m - 1) % cardinality(v_coment)) + 1 ],
              v_data_ref - make_interval(hours => 2 + v_m))
      on conflict (id) do nothing;
    end loop;

    select t.titulo into v_aux_txt from public.tarefas t where t.id = v_aluno_tarefas[1];
    insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                             descricao, data_hora)
    values (public.demo_uuid_seed('hist:move:' || v_i), v_aluno, v_aluno_tarefas[1],
            'movimentou_card',
            format('Moveu "%s" no kanban', v_aux_txt),
            v_data_ref - interval '3 hours')
    on conflict do nothing;

    select t.id, t.titulo into v_aux_id, v_aux_txt
      from public.tarefas t
     where t.aluno_id = v_aluno and t.status = 'a_fazer'
     order by t.posicao
     limit 1;
    if v_aux_id is null then
      v_aux_id := v_aluno_tarefas[cardinality(v_aluno_tarefas)];
      select t.titulo into v_aux_txt from public.tarefas t where t.id = v_aux_id;
    end if;
    insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                             descricao, data_hora)
    values (public.demo_uuid_seed('hist:assume:' || v_i), v_aluno, v_aux_id,
            'assumiu_tarefa', format('Assumiu a tarefa "%s"', v_aux_txt),
            v_data_ref - interval '4 hours')
    on conflict do nothing;

    foreach v_aux_id in array v_imp_tasks loop
      select t.titulo into v_aux_txt from public.tarefas t where t.id = v_aux_id;
      insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                               descricao, data_hora)
      values (public.demo_uuid_seed('hist:block:' || v_aux_id), v_aluno, v_aux_id,
              'bloqueou', format('Bloqueou "%s": aguardando destravamento', v_aux_txt),
              v_data_ref - interval '6 hours')
      on conflict do nothing;
    end loop;
  end loop;

  -- 7.1 tarefas SEM aluno em cada equipe (alimenta "Backlog Disponível")
  for v_t in 1..12 loop
    for v_m in 1..2 loop
      v_proj := case when v_m = 1 then v_proj_a[v_t] else v_proj_b[v_t] end;
      v_cont_pos[v_proj] := v_cont_pos[v_proj] + 1;
      v_kproj := v_cont_pos[v_proj];
      v_titulo := v_modulos[ ((v_kproj - 1) % 10) + 1 ]
                  || ' — ' ||
                  v_acoes[ (((v_kproj - 1) / 10) % 6 ) + 1 ];
      insert into public.tarefas (id, projeto_id, equipe_id, aluno_id, titulo, descricao,
                                  prioridade, estimativa, status, posicao, prazo_limite,
                                  is_impedida, aguardando_validacao, created_at, updated_at)
      values (public.demo_uuid_seed('tarefa:backlog:' || v_t || ':' || v_m),
              public.demo_uuid_seed('projeto:' || v_proj),
              public.demo_uuid_seed('equipe:' || v_t),
              null, v_titulo,
              format('Item do backlog da equipe %s, disponível para qualquer membro assumir.',
                     v_equipes_nomes[v_t]),
              'media', v_estimativas[ ((v_kproj - 1) % 8) + 1 ],
              'backlog', v_kproj * 10,
              (v_hoje + 10 + v_m)::timestamp + interval '22 hours',
              false, false, now(), now())
      on conflict (id) do nothing;
    end loop;
  end loop;

  -- 7.2 validações feitas pelos professores (histórico 'aprovou_conclusao')
  insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                           descricao, data_hora)
  select public.demo_uuid_seed('hist:aprov:' || t.id),
         case when ascii(substr(md5('aprov:' || t.id::text), 1, 1)) % 2 = 0
              then v_prof1 else v_prof2 end,
         t.id, 'aprovou_conclusao',
         format('Validou a conclusão da tarefa "%s"', t.titulo),
         t.updated_at + interval '3 hours'
    from public.tarefas t
   where t.aluno_id in (select u.id from public.usuarios u where u.email like '%@demo.com')
     and t.status = 'concluido'
     and t.aguardando_validacao = false
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 8) DAILY_REGISTERS (>= 3 por aluno) + histórico 'daily_checkin'
  -- ===========================================================================
  for v_i in 1..50 loop
    v_perfil := v_i % 5;
    v_eq1    := ((v_i - 1) % 12) + 1;
    v_aluno  := public.demo_uuid_seed('user:aluno' || lpad(v_i::text, 2, '0') || '@demo.com');

    for v_m in 1..v_p_dailys[v_perfil + 1] loop
      v_data_checkin := v_hoje - (v_p_ancora[v_perfil + 1] + (v_m - 1));
      insert into public.daily_registers (id, equipe_id, aluno_id, data_checkin,
                                          o_que_fez, licao_aprendida, impedimento,
                                          created_at, updated_at)
      values (public.demo_uuid_seed('daily:' || v_i || ':' || v_m),
              public.demo_uuid_seed('equipe:' || v_eq1),
              v_aluno, v_data_checkin,
              v_daily_fez[ ((v_i + v_m) % 6) + 1 ],
              v_daily_lic[ ((v_i + v_m) % 6) + 1 ],
              case when (v_i + v_m) % 3 = 0 or v_perfil = 3
                   then v_daily_imp[ ((v_i + v_m) % 4) + 1 ]
                   else null end,
              (v_data_checkin::timestamp + interval '8 hours'),
              (v_data_checkin::timestamp + interval '8 hours'))
      on conflict (aluno_id, data_checkin) do nothing;
    end loop;
  end loop;

  insert into public.historico_atividades (id, usuario_id, tarefa_id, tipo_acao,
                                           descricao, data_hora)
  select public.demo_uuid_seed('hist:daily:' || d.id),
         d.aluno_id, null, 'daily_checkin',
         'Registrou o check-in diário (' || d.data_checkin || ')',
         (d.data_checkin::timestamp + interval '8 hours')
    from public.daily_registers d
   where d.aluno_id in (select u.id from public.usuarios u where u.email like '%@demo.com')
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 9) AVALIAÇÃO POR PARES
  --    Limpa a sessão JWT: a 0013 só permite escrita de avaliacao com
  --    auth.uid() nulo (seed) — durante a aplicacao normal, o aluno só escreve
  --    as proprias avaliacoes.
  -- ===========================================================================
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  insert into public.avaliacoes_periodos (id, nome, data_inicio, data_final, estado) values
    (public.demo_uuid_seed('periodo:1'), 'Sprint 1', v_hoje - 45, v_hoje - 31, 'encerrado'),
    (public.demo_uuid_seed('periodo:2'), 'Sprint 2', v_hoje - 30, v_hoje + 7,  'aberto'),
    (public.demo_uuid_seed('periodo:3'), 'Sprint 3', v_hoje + 8,  v_hoje + 22, 'rascunho')
  on conflict (id) do nothing;

  for v_per in 1..2 loop
    for v_t in 1..12 loop
      -- membros da equipe (primários + secundários), em ordem de índice
      select array_agg(n order by n) into v_mem
        from generate_series(1, 50) n
       where (((n - 1) % 12) + 1) = v_t
          or (n % 5 = 0 and (case when ((n - 1) % 12) = 11 then 1
                                  else ((n - 1) % 12) + 2 end) = v_t);

      for v_a in 1..array_length(v_mem, 1) loop
        for v_b in 1..array_length(v_mem, 1) loop
          if v_mem[v_a] <> v_mem[v_b] then
            -- rascunho de demonstração: ultimo colega do avaliado, apenas nos
            -- Sprints 2 de equipes pares (as demais ficam 100% 'enviada')
            v_ult := v_mem[array_length(v_mem, 1)];
            if v_ult = v_mem[v_b] then
              v_ult := v_mem[array_length(v_mem, 1) - 1];
            end if;
            v_rascunho := (v_per = 2)
                          and (v_t % 2 = 0)
                          and (array_length(v_mem, 1) >= 5)
                          and (v_mem[v_a] = v_ult);

            -- 5 notas deterministicas entre 2 e 5
            for v_m in 1..5 loop
              v_notas[v_m] := 2 + (ascii(substr(
                md5('peer:' || v_per || ':' || v_mem[v_a] || ':' || v_mem[v_b] || ':' || v_m),
                1, 1)) % 4);
            end loop;

            if v_rascunho then
              v_est_av    := 'rascunho';
              v_coment_txt := null;
              v_notas[4]  := null;
              v_notas[5]  := null;
            else
              v_est_av := 'enviada';
              -- ~50% dos pares recebem comentario visivel
              if ascii(substr(md5('cmt:' || v_per || ':' || v_mem[v_a] || ':' || v_mem[v_b]), 1, 1)) % 2 = 0 then
                v_coment_txt := v_peer_coment[ (ascii(substr(
                  md5('pc:' || v_per || ':' || v_mem[v_a] || ':' || v_mem[v_b]), 1, 1)) % 6) + 1 ];
              else
                v_coment_txt := null;
              end if;
            end if;

            insert into public.peer_avaliacoes (
              id, periodo_id, equipe_id, avaliador_id, avaliado_id,
              colaboracao, responsabilidade, comunicacao, qualidade_entregas, autonomia,
              comentario, estado, created_at, updated_at)
            values (
              public.demo_uuid_seed('peer:' || v_per || ':' || v_mem[v_a] || ':' || v_mem[v_b]),
              public.demo_uuid_seed('periodo:' || v_per),
              public.demo_uuid_seed('equipe:' || v_t),
              public.demo_uuid_seed('user:aluno' || lpad(v_mem[v_a]::text, 2, '0') || '@demo.com'),
              public.demo_uuid_seed('user:aluno' || lpad(v_mem[v_b]::text, 2, '0') || '@demo.com'),
              v_notas[1], v_notas[2], v_notas[3], v_notas[4], v_notas[5],
              v_coment_txt, v_est_av,
              now() - make_interval(days => case when v_per = 1 then 35 else 4 end)
                     - make_interval(hours => (v_mem[v_a] + v_mem[v_b]) % 8),
              now() - make_interval(days => case when v_per = 1 then 35 else 4 end)
                     - make_interval(hours => (v_mem[v_a] + v_mem[v_b]) % 8))
            on conflict do nothing;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  -- ===========================================================================
  -- 10) RESUMO + LIMPEZA DO HELPER
  -- ===========================================================================
  raise notice 'SEED_NEW: usuarios=% turmas=% equipes=% membros=% projetos=% vinculos=% tarefas=% checklists=% dailys=% historico=% periodos=% avaliacoes_pares=%',
    (select count(*) from public.usuarios),
    (select count(*) from public.turmas),
    (select count(*) from public.equipes),
    (select count(*) from public.equipe_membros),
    (select count(*) from public.projetos),
    (select count(*) from public.projeto_equipes),
    (select count(*) from public.tarefas),
    (select count(*) from public.checklists),
    (select count(*) from public.daily_registers),
    (select count(*) from public.historico_atividades),
    (select count(*) from public.avaliacoes_periodos),
    (select count(*) from public.peer_avaliacoes);

  drop function if exists public.demo_uuid_seed(text);
end $seed$;

-- -----------------------------------------------------------------------------
-- RELATÓRIO DE CHECAGENS (tudo deve sair OK)
-- -----------------------------------------------------------------------------
with chec as (
  select 'auth.users demo'            as item,
         (select count(*) from auth.users
           where email like '%@demo.com' or email in ('admin@escola.com','carlos@escola.com','beatriz@escola.com'))::int as valor,
         53 as esperado, '=' as op
  union all select 'identidades de login',
         (select count(*) from auth.identities i join auth.users u on u.id = i.user_id
           where u.email like '%@demo.com' or u.email in ('admin@escola.com','carlos@escola.com','beatriz@escola.com'))::int,
         53, '='
  union all select 'alunos',
         (select count(*) from public.usuarios where papel = 'aluno' and email like '%@demo.com')::int, 50, '='
  union all select 'professores',
         (select count(*) from public.usuarios where papel = 'professor'
           and email in ('carlos@escola.com','beatriz@escola.com'))::int, 2, '='
  union all select 'gestor (administrador)',
         (select count(*) from public.usuarios where papel = 'gestor' and email = 'admin@escola.com')::int, 1, '='
  union all select 'turmas',
         (select count(*) from public.turmas where codigo_acesso in ('TI-A-2026','DS-B-2026'))::int, 2, '='
  union all select 'equipes',
         (select count(*) from public.equipes where nome in
           ('Fênix Code','Nebulosa Dev','Órbita Tech','Prisma Labs','Quartz Digital','Ravina Soft',
            'Sagitário Dev','Titan Byte','Úrsula Code','Vulcão Labs','Warp Dev','Zênite Code'))::int, 12, '='
  union all select 'vinculos equipe/aluno',
         (select count(*) from public.equipe_membros em join public.usuarios u on u.id = em.aluno_id
           where u.email like '%@demo.com')::int, 60, '='
  union all select 'alunos em 2 equipes',
         (select count(*) from (select em.aluno_id from public.equipe_membros em
                                  join public.usuarios u on u.id = em.aluno_id
                                 where u.email like '%@demo.com'
                                 group by em.aluno_id having count(*) = 2) s)::int, 10, '='
  union all select 'equipes com alunos das 2 turmas',
         (select count(*) from (select em.equipe_id from public.equipe_membros em
                                  join public.usuarios u on u.id = em.aluno_id
                                 where u.email like '%@demo.com'
                                 group by em.equipe_id having count(distinct u.turma_id) = 2) s)::int, 12, '='
  union all select 'projetos',
         (select count(*) from public.projetos where nome in
           ('Portal Cultural Escolar','Gestão de Chamadas','Feira de Ciências Digital',
            'Biblioteca Sem Papel','Radar de Aprendizagem','Arena de Projetos'))::int, 6, '='
  union all select 'vinculos projeto/equipe',
         (select count(*) from public.projeto_equipes pe
           join public.projetos p on p.id = pe.projeto_id
          where p.nome in ('Portal Cultural Escolar','Gestão de Chamadas','Feira de Ciências Digital',
                           'Biblioteca Sem Papel','Radar de Aprendizagem','Arena de Projetos'))::int, 24, '='
  union all select 'equipes em >= 2 projetos',
         (select count(*) from (select pe.equipe_id from public.projeto_equipes pe
                                  join public.equipes e on e.id = pe.equipe_id
                                 where e.nome in ('Fênix Code','Nebulosa Dev','Órbita Tech','Prisma Labs',
                                                  'Quartz Digital','Ravina Soft','Sagitário Dev','Titan Byte',
                                                  'Úrsula Code','Vulcão Labs','Warp Dev','Zênite Code')
                                 group by pe.equipe_id having count(*) >= 2) s)::int, 12, '='
  union all select 'projetos com >= 12 tarefas',
         (select count(*) from (select t.projeto_id from public.tarefas t
                                 group by t.projeto_id having count(*) >= 12) s)::int, 6, '='
  union all select 'tarefas (total)',
         (select count(*) from public.tarefas)::int, 300, '>='
  union all select 'status distintos no kanban',
         (select count(distinct status) from public.tarefas)::int, 4, '='
  union all select 'alunos com tarefas em >= 2 status',
         (select count(*) from (select t.aluno_id from public.tarefas t
                                  join public.usuarios u on u.id = t.aluno_id
                                 where u.email like '%@demo.com'
                                 group by t.aluno_id having count(distinct t.status) >= 2) s)::int, 50, '='
  union all select 'tarefas aguardando validacao',
         (select count(*) from public.tarefas where aguardando_validacao)::int, 10, '>='
  union all select 'tarefas impedidas',
         (select count(*) from public.tarefas where is_impedida)::int, 10, '>='
  union all select 'tarefas atrasadas (nao concluidas)',
         (select count(*) from public.tarefas
           where status <> 'concluido' and prazo_limite < now())::int, 10, '>='
  union all select 'backlog sem aluno',
         (select count(*) from public.tarefas where aluno_id is null and status = 'backlog')::int, 12, '>='
  union all select 'checklists',
         (select count(*) from public.checklists)::int, 1000, '>='
  union all select 'daily registers (>= 3 por aluno)',
         (select count(*) from (select d.aluno_id from public.daily_registers d
                                  join public.usuarios u on u.id = d.aluno_id
                                 where u.email like '%@demo.com'
                                 group by d.aluno_id having count(*) >= 3) s)::int, 50, '='
  union all select 'tipos de historico (7)',
         (select count(distinct tipo_acao) from public.historico_atividades)::int, 7, '='
  union all select 'periodos de avaliacao (3 estados)',
         (select count(distinct estado) from public.avaliacoes_periodos)::int, 3, '='
  union all select 'avaliacoes por pares',
         (select count(*) from public.peer_avaliacoes)::int, 400, '>='
  union all select 'avaliacoes duplicadas (par)',
         (select count(*) from (select periodo_id, avaliador_id, avaliado_id
                                  from public.peer_avaliacoes
                                 group by 1, 2, 3 having count(*) > 1) s)::int, 0, '='
  union all select 'alunos avaliados no Sprint 2',
         (select count(distinct a.avaliado_id) from public.peer_avaliacoes a
           join public.avaliacoes_periodos p on p.id = a.periodo_id
          where p.nome = 'Sprint 2')::int, 50, '='
  union all select 'alunos que enviaram no Sprint 2',
         (select count(distinct a.avaliador_id) from public.peer_avaliacoes a
           join public.avaliacoes_periodos p on p.id = a.periodo_id
          where p.nome = 'Sprint 2')::int, 50, '='
  union all select 'rascunhos (Sprint 2)',
         (select count(*) from public.peer_avaliacoes a
           join public.avaliacoes_periodos p on p.id = a.periodo_id
          where p.nome = 'Sprint 2' and a.estado = 'rascunho')::int, 10, '>='
)
select item as checagem,
       valor,
       esperado,
       case when (op = '=' and valor = esperado) or (op = '>=' and valor >= esperado)
            then 'OK' else 'FALHA' end as status
  from chec
 order by (case when (op = '=' and valor = esperado) or (op = '>=' and valor >= esperado)
                then 1 else 0 end), item;

-- -----------------------------------------------------------------------------
-- CREDENCIAIS PARA LOGIN (Supabase Auth)
-- -----------------------------------------------------------------------------
select papel, nome, email,
       case when email like '%@demo.com' then 'Mudar123' else '123456' end as senha
  from public.usuarios
 where email like '%@demo.com'
    or email in ('admin@escola.com', 'carlos@escola.com', 'beatriz@escola.com')
 order by case papel when 'gestor' then 1 when 'professor' then 2 else 3 end, email;

-- -----------------------------------------------------------------------------
-- DISTRIBUIÇÃO DO RADAR DE ENGAJAMENTO
-- (replica src/utils/engagementRadar.js — devem aparecer as 4 situações)
-- -----------------------------------------------------------------------------
with base as (
  select u.id, u.nome,
         (select count(*) from public.tarefas t
           where t.aluno_id = u.id and t.status = 'concluido') as concluidas,
         (select count(*) from public.tarefas t
           where t.aluno_id = u.id and t.status <> 'concluido'
             and t.prazo_limite < now()) as atrasadas,
         (select count(*) from public.tarefas t
           where t.aluno_id = u.id and t.is_impedida) as impedidas,
         (select count(*) from public.historico_atividades h
           where h.usuario_id = u.id and h.tipo_acao = 'daily_checkin') as dailys_hist,
         (select count(*) from public.historico_atividades h
           where h.usuario_id = u.id and h.tipo_acao = 'concluiu_checklist') as checklists,
         (select count(*) from public.historico_atividades h
           where h.usuario_id = u.id and h.tipo_acao = 'comentou') as comentarios,
         coalesce((select floor(extract(epoch from (now() - max(h.data_hora))) / 86400)
                    from public.historico_atividades h
                   where h.usuario_id = u.id), 7) as dias_sem_atividade
    from public.usuarios u
   where u.papel = 'aluno' and u.email like '%@demo.com'
), scores as (
  select nome,
         greatest(0, least(100, round(
           (concluidas * 4) + (dailys_hist * 2) + (checklists * 2) + comentarios
           - (atrasadas * 3) - (impedidas * 2)
           - case when dias_sem_atividade > 3 then dias_sem_atividade * 1.5
                  else dias_sem_atividade end)))::int as score,
         case when (concluidas * 4) + (dailys_hist * 2) + (checklists * 2) + comentarios
                   - (atrasadas * 3) - (impedidas * 2)
                   - case when dias_sem_atividade > 3 then dias_sem_atividade * 1.5
                          else dias_sem_atividade end < 25
              then 'Crítica (<25)'
              when (concluidas * 4) + (dailys_hist * 2) + (checklists * 2) + comentarios
                   - (atrasadas * 3) - (impedidas * 2)
                   - case when dias_sem_atividade > 3 then dias_sem_atividade * 1.5
                          else dias_sem_atividade end < 55
              then 'Atenção (25-54)'
              when (concluidas * 4) + (dailys_hist * 2) + (checklists * 2) + comentarios
                   - (atrasadas * 3) - (impedidas * 2)
                   - case when dias_sem_atividade > 3 then dias_sem_atividade * 1.5
                          else dias_sem_atividade end < 80
              then 'Boa Participação (55-79)'
              else 'Protagônico (>=80)' end as situacao
    from base
)
select situacao, count(*) as alunos, min(score) as score_min, max(score) as score_max,
       round(avg(score))::int as score_medio
  from scores
 group by situacao
 order by min(score) desc;
