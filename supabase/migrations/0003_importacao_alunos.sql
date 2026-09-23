-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0003: IMPORTAÇÃO DE ALUNOS (EXCEL/CSV)
-- -----------------------------------------------------------------------------
-- Corrige o erro: "Could not find the 'matricula' column of 'usuarios'"
-- no Modo Conectado ao importar planilha na tela Turmas & Alunos.
--
-- O que faz:
--   1) Adiciona a coluna matricula em public.usuarios (se não existir);
--   2) Cria a função SECURITY DEFINER importar_aluno(...) que:
--      - cria o usuário em auth.users com senha padrão Mudar123;
--      - cria a identidade provider 'email' (necessária para login);
--      - dispara o trigger handle_new_user -> public.usuarios;
--      - grava turma_id e matricula no perfil.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- 1) Coluna matricula (idempotente)
alter table public.usuarios add column if not exists matricula text;

-- 2) Função de importação (Security Definer: cria Auth + perfil)
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
    raise exception 'E-mail inválido: %', coalesce(p_email, '(vazio)');
  end if;

  if exists (select 1 from public.usuarios where email = v_email) then
    raise exception 'E-mail já cadastrado: %', v_email;
  end if;

  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
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
    now()
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

-- 3) Permissões: apenas sessão autenticada (professor/gestor na importação)
revoke all on function public.importar_aluno(text, text, uuid, text, text) from public;
revoke all on function public.importar_aluno(text, text, uuid, text, text) from anon;
grant execute on function public.importar_aluno(text, text, uuid, text, text) to authenticated;

-- 4) Verificação
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'usuarios'
   and column_name in ('matricula', 'primeiro_acesso', 'senha');
