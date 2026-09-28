-- =============================================================================
-- EDUPROJECT AGILE - MIGRACAO 0010: ALTERAR SENHA/E-MAIL DA CONTA DE LOGIN
-- -----------------------------------------------------------------------------
-- Problema: a tela "Gerenciar Usuarios" (e o Perfil) gravava a nova senha em
-- public.usuarios.senha (coluna deprecada pelo schema 0001), mas o login usa o
-- Supabase Auth (auth.users.encrypted_password). Resultado: a senha "mudava"
-- no sistema e o usuario nao conseguia entrar com ela.
--
-- Esta RPC (SECURITY DEFINER) passa a ser o unico caminho de troca de acesso:
--   * senha  -> auth.users.encrypted_password (bcrypt via extensions/pgcrypto);
--   * e-mail -> auth.users.email + auth.identities.identity_data (provider email);
--   * espelha a senha em public.usuarios.senha (paridade com o modo mock);
--   * confirma o e-mail da conta (o admin/professor esta definindo o acesso);
--   * revoga as sessoes do usuario (menos quando ele muda a propria senha);
--   * regras: gestor altera qualquer conta; professor altera SOMENTE alunos;
--     qualquer usuario autenticado pode alterar a propria senha; execucao
--     direta no SQL Editor (postgres, sem auth.uid()) tambem e permitida.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.alterar_acesso_usuario(
  p_usuario_id uuid,
  p_senha text default null,
  p_email text default null
) returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_papel_alvo   public.user_papel;
  v_email_novo   text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_email_atual  text;
  v_senha_nova   text := nullif(coalesce(p_senha, ''), '');
  v_alterado     boolean := false;
begin
  if p_usuario_id is null then
    raise exception 'Informe o usuario.';
  end if;

  select papel into v_papel_alvo from public.usuarios where id = p_usuario_id;

  -- 1) Permissao ------------------------------------------------------------
  -- Sem sessao (SQL Editor/postgres) ou alterando a propria conta: segue.
  -- Alterando OUTRA conta: exige professor/gestor, e professor so mexe em alunos.
  if v_uid is not null and p_usuario_id <> v_uid then
    if not public.is_professor() then
      raise exception 'Acesso negado: apenas professor/gestor pode alterar o acesso de outros usuarios.';
    end if;
    if public.usuario_papel() <> 'gestor' and v_papel_alvo is distinct from 'aluno' then
      raise exception 'Professores so podem alterar a senha de alunos. Contas de professor/gestor sao alteradas pelo gestor.';
    end if;
  end if;

  -- 2) Nada informado: mantem tudo como esta -------------------------------
  if v_senha_nova is null and v_email_novo is null then
    return false;
  end if;
  if v_senha_nova is not null and length(v_senha_nova) < 6 then
    raise exception 'A senha deve ter no minimo 6 caracteres.';
  end if;

  -- 3) Conta de login (auth.users) ------------------------------------------
  select email into v_email_atual from auth.users where id = p_usuario_id;
  if not found then
    if v_senha_nova is not null then
      raise exception 'Este usuario nao possui conta de login para receber a nova senha.';
    end if;
    return false;
  end if;

  -- 4) Troca de e-mail de login ---------------------------------------------
  if v_email_novo is not null and v_email_novo <> lower(coalesce(v_email_atual, '')) then
    if exists (select 1 from auth.users where lower(email) = v_email_novo and id <> p_usuario_id) then
      raise exception 'Ja existe uma conta de login com este e-mail: %', v_email_novo;
    end if;
    if exists (select 1 from public.usuarios where lower(email) = v_email_novo and id <> p_usuario_id) then
      raise exception 'Ja existe outro usuario com este e-mail: %', v_email_novo;
    end if;

    update auth.users
       set email = v_email_novo,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = p_usuario_id;

    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email_novo), true),
           updated_at = now()
     where user_id = p_usuario_id and provider = 'email';

    v_alterado := true;
  end if;

  -- 5) Troca de senha --------------------------------------------------------
  if v_senha_nova is not null then
    update auth.users
       set encrypted_password = extensions.crypt(v_senha_nova, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = p_usuario_id;

    -- espelho deprecado (paridade com o modo mock / telas que exibem a senha)
    update public.usuarios set senha = v_senha_nova where id = p_usuario_id;

    v_alterado := true;
  end if;

  -- 6) Revoga sessoes antigas (a conta passa a valer com o novo acesso) ------
  if v_alterado and v_uid is distinct from p_usuario_id then
    begin
      delete from auth.sessions where user_id = p_usuario_id;
    exception when others then
      raise notice 'sessoes nao revogadas (%): %', p_usuario_id, sqlerrm;
    end;
    begin
      delete from auth.refresh_tokens where user_id = p_usuario_id;
    exception when others then
      raise notice 'refresh tokens nao revogados (%): %', p_usuario_id, sqlerrm;
    end;
  end if;

  return v_alterado;
end;
$$;

revoke all on function public.alterar_acesso_usuario(uuid, text, text) from public;
revoke all on function public.alterar_acesso_usuario(uuid, text, text) from anon;
grant execute on function public.alterar_acesso_usuario(uuid, text, text) to authenticated;

-- Verificacao
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'alterar_acesso_usuario';
