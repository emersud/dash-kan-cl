-- =============================================================================
-- EDUPROJECT AGILE — MIGRAÇÃO 0004: EXCLUSÃO COMPLETA DE USUÁRIO/ALUNO
-- -----------------------------------------------------------------------------
-- Usado pela tela Turmas & Alunos (excluir turma + alunos) e Gerenciar
-- Usuários: remove o aluno e TODAS as ligações:
--   * tarefas alocadas (aluno_id) + checklists (cascade)
--   * daily_registers
--   * historico_atividades
--   * equipe_membros (vínculo com equipes)
--   * perfil public.usuarios e conta auth.users (login)
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.excluir_usuario_completo(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_professor() then
    raise exception 'Acesso negado: apenas professor/gestor pode excluir usuários.';
  end if;

  if p_usuario_id is null then
    raise exception 'Informe o usuário a ser excluído.';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'Você não pode excluir o próprio usuário logado.';
  end if;

  -- 1) Tarefas alocadas ao aluno (checklists caem em cascade)
  delete from public.tarefas where aluno_id = p_usuario_id;

  -- 2) Daily registers do aluno
  delete from public.daily_registers where aluno_id = p_usuario_id;

  -- 3) Histórico de atividades do aluno
  delete from public.historico_atividades where usuario_id = p_usuario_id;

  -- 4) Vínculo com equipes
  delete from public.equipe_membros where aluno_id = p_usuario_id;

  -- 5) Conta Auth (cascata remove public.usuarios via FK)
  delete from auth.users where id = p_usuario_id;

  -- 6) Se não existia no Auth (perfil órfão), remove o perfil direto
  delete from public.usuarios where id = p_usuario_id;
end;
$$;

revoke all on function public.excluir_usuario_completo(uuid) from public;
revoke all on function public.excluir_usuario_completo(uuid) from anon;
grant execute on function public.excluir_usuario_completo(uuid) to authenticated;

-- Verificação
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'excluir_usuario_completo';
