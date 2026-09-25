-- =============================================================================
-- EDUPROJECT AGILE — MIGRACAO 0007: CONTAS AUTH PARA O GESTOR
-- -----------------------------------------------------------------------------
-- A tela "Gerenciar Usuarios" (perfil GESTOR) passa a listar TODAS as contas do
-- sistema, inclusive as que nunca confirmaram o e-mail e as contas que existem
-- apenas no auth.users (sem perfil em public.usuarios).
--
-- * So o GESTOR recebe a lista (demais perfis recebem [] e a tela continua
--   mostrando apenas o que ja mostrava).
-- * Retorna JSON com: id, email, email_confirmado, criado_em, tem_perfil,
--   nome, papel, turma_id.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.listar_usuarios_auth()
returns json
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_result json;
begin
  -- Somente o gestor enxerga as contas de login (auth.users)
  if public.usuario_papel() <> 'gestor' then
    return '[]'::json;
  end if;

  select coalesce(json_agg(x order by x.criado_em desc), '[]'::json)
    into v_result
  from (
    select
      u.id,
      u.email,
      (u.email_confirmed_at is not null) as email_confirmado,
      u.created_at as criado_em,
      (p.id is not null) as tem_perfil,
      coalesce(p.nome, u.raw_user_meta_data ->> 'nome', split_part(u.email, '@', 1)) as nome,
      p.papel,
      p.turma_id
    from auth.users u
    left join public.usuarios p on p.id = u.id
  ) x;

  return v_result;
end;
$$;

revoke all on function public.listar_usuarios_auth() from public;
revoke all on function public.listar_usuarios_auth() from anon;
grant execute on function public.listar_usuarios_auth() to authenticated;

-- Verificacao
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'listar_usuarios_auth';
