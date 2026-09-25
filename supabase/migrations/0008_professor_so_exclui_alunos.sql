-- =============================================================================
-- EDUPROJECT AGILE — MIGRACAO 0008: PROFESSOR SO EXCLUI ALUNOS
-- -----------------------------------------------------------------------------
-- Regra de permissao de exclusao:
--   * GESTOR    : exclui qualquer usuario (gestor, professor ou aluno).
--   * PROFESSOR : exclui APENAS alunos — nao pode excluir gestores nem outros
--                 professores.
--   * ALUNO     : nao exclui ninguem (sem permissao de exclusao).
--
-- Vale na tela "Gerenciar Usuarios" (e na RPC usada por Turmas & Alunos) e no
-- RLS da tabela public.usuarios (exclusao direta).
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- 1) RPC de exclusao completa: conferencia do papel do alvo --------------
create or replace function public.excluir_usuario_completo(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_alvo_papel public.user_papel;
begin
  if not public.is_professor() then
    raise exception 'Acesso negado: apenas professor/gestor pode excluir usuarios.';
  end if;

  if p_usuario_id is null then
    raise exception 'Informe o usuario a ser excluido.';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'Voce nao pode excluir o proprio usuario logado.';
  end if;

  -- REGRA NOVA: professor so exclui alunos.
  select papel into v_alvo_papel from public.usuarios where id = p_usuario_id;
  if public.usuario_papel() <> 'gestor' and v_alvo_papel is distinct from 'aluno' then
    raise exception 'Professores so podem excluir alunos. Gestores e professores so podem ser excluidos pelo gestor.';
  end if;

  -- 1) Tarefas alocadas ao aluno (checklists caem em cascade)
  delete from public.tarefas where aluno_id = p_usuario_id;

  -- 2) Daily registers do aluno
  delete from public.daily_registers where aluno_id = p_usuario_id;

  -- 3) Historico de atividades do aluno
  delete from public.historico_atividades where usuario_id = p_usuario_id;

  -- 4) Vinculo com equipes
  delete from public.equipe_membros where aluno_id = p_usuario_id;

  -- 5) Conta Auth (cascata remove public.usuarios via FK)
  delete from auth.users where id = p_usuario_id;

  -- 6) Se nao existia no Auth (perfil orfao), remove o perfil direto
  delete from public.usuarios where id = p_usuario_id;
end;
$$;

revoke all on function public.excluir_usuario_completo(uuid) from public;
revoke all on function public.excluir_usuario_completo(uuid) from anon;
grant execute on function public.excluir_usuario_completo(uuid) to authenticated;

-- 2) RLS de exclusao em public.usuarios -----------------------------------
drop policy if exists "usuarios_delete_professor" on public.usuarios;
drop policy if exists "usuarios_delete_aluno_or_gestor" on public.usuarios;
create policy "usuarios_delete_aluno_or_gestor" on public.usuarios
  for delete to authenticated
  using (
    public.is_professor()
    and (public.usuario_papel() = 'gestor' or papel = 'aluno')
  );

-- Verificacao
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'excluir_usuario_completo';
