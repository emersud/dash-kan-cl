-- =============================================================================
-- EDUPROJECT AGILE - MIGRACAO 0011: LOGIN DOS ALUNOS IMPORTADOS (500 NO LOGIN)
-- -----------------------------------------------------------------------------
-- Problema: contas criadas pela RPC importar_aluno (migrao 0003) inserem em
-- auth.users SEM as colunas de token, que ficam NULL. O GoTrue v2 quebra ao
-- ler a linha e o login retorna:
--     500 unexpected_failure - "Database error querying schema"
-- Isso acontece COM ou SEM senha certa - ou seja, o aluno importado nunca
-- consegue entrar (o 0002_seed ja trazia a normalizacao; a importao nao).
--
-- Conferido nesta base: carlos@escola.com (seed) loga com 200, enquanto
-- bianca.ramos@escola.com e todos os alunos importados retornam 500.
--
-- O que faz:
--   1) Normaliza NULL -> '' nas colunas de token de TODAS as contas auth.users
--      (idempotente, so roda se a coluna existir);
--   2) Recria public.importar_aluno ja gravando '' nesses campos, para que
--      novos alunos importados nasam prontos para o login.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- 1) Normalizacao das contas existentes -------------------------------------
do $$
declare
  col text;
  colunas text[] := array[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ];
  total bigint := 0;
begin
  foreach col in array colunas loop
    if exists (
      select 1
        from information_schema.columns
       where table_schema = 'auth'
         and table_name = 'users'
         and column_name = col
    ) then
      execute format('update auth.users set %I = '''' where %I is null', col, col);
      get diagnostics total = row_count;
      raise notice 'coluna %: % linha(s) normalizada(s)', col, total;
    end if;
  end loop;
end $$;

-- 2) importar_aluno corrigida (tokens '' e nao NULL) ------------------------
create or replace function public.importar_aluno(
  p_nome     text,
  p_email    text,
  p_turma_id uuid default null,
  p_matricula text default null,
  p_senha    text default 'Mudar123'
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_id    uuid;
  v_email text := lower(trim(p_email));
begin
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Informe o nome do aluno.';
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'E-mail invalido: %', coalesce(p_email, '(vazio)');
  end if;

  if exists (select 1 from public.usuarios where email = v_email) then
    raise exception 'E-mail ja cadastrado: %', v_email;
  end if;

  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    -- GoTrue v2: estas colunas precisam ser '' e nunca NULL (migrao 0011)
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'nome', p_nome,
      'papel', 'aluno',
      'turma_id', coalesce(p_turma_id::text, ''),
      'primeiro_acesso', true,
      'matricula', coalesce(p_matricula, '')
    ),
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_id,
    v_id::text,
    jsonb_build_object(
      'sub', v_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Trigger on_auth_user_created deve ter criado o perfil; garante campos.
  update public.usuarios
     set turma_id       = coalesce(p_turma_id, turma_id),
         matricula      = p_matricula,
         primeiro_acesso = true
   where id = v_id;

  if not found then
    insert into public.usuarios (
      id, nome, email, papel, turma_id, matricula, primeiro_acesso
    ) values (
      v_id, p_nome, v_email, 'aluno', p_turma_id, p_matricula, true
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.importar_aluno(text, text, uuid, text, text) from public;
revoke all on function public.importar_aluno(text, text, uuid, text, text) from anon;
grant execute on function public.importar_aluno(text, text, uuid, text, text) to authenticated;

-- 3) Verificacao: nenhuma linha pode sobrar com token NULL -------------------
select count(*) as contas_com_token_null
  from auth.users
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null
    or email_change_token_current is null
    or phone_change is null
    or phone_change_token is null
    or reauthentication_token is null;
