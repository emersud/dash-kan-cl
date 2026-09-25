-- 0006_permissao_tarefas_aluno.sql
-- Regras de permissao entre professor/gestor e alunos (tarefas):
--   * aluno CRIA e EXCLUI tarefas apenas da propria equipe;
--   * a conclusao de tarefa so vale quando professor/gestor insere a flag
--     (status = 'concluido' e aguardando_validacao = false);
--   * professor/gestor mantem acesso total.

-- 1) TAREFAS: aluno insere tarefas somente da propria equipe
drop policy if exists "tarefas_insert_professor" on public.tarefas;
drop policy if exists "tarefas_insert_team_or_professor" on public.tarefas;
create policy "tarefas_insert_team_or_professor" on public.tarefas
  for insert to authenticated
  with check (
    public.is_professor()
    or equipe_id in (select public.equipes_do_uid())
  );

-- 2) TAREFAS: aluno exclui somente tarefas da propria equipe
drop policy if exists "tarefas_delete_professor" on public.tarefas;
drop policy if exists "tarefas_delete_team_or_professor" on public.tarefas;
create policy "tarefas_delete_team_or_professor" on public.tarefas
  for delete to authenticated
  using (
    public.is_professor()
    or equipe_id in (select public.equipes_do_uid())
  );

-- 3) TRIGGER: conclusao efetiva exige a flag do professor/gestor
--    Aluno pode mover para 'concluido' apenas com aguardando_validacao = true.
create or replace function public.bloquear_conclusao_sem_validacao()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if public.is_professor() then
    return new;
  end if;

  -- aluno criando uma tarefa ja efetivada
  if tg_op = 'INSERT'
     and new.status = 'concluido'
     and coalesce(new.aguardando_validacao, false) = false then
    raise exception 'Aluno nao pode concluir tarefa sem a validacao do professor/gestor';
  end if;

  -- aluno tentando inserir/remover a propria flag de concluido
  if tg_op = 'UPDATE'
     and new.status = 'concluido'
     and coalesce(new.aguardando_validacao, false) = false
     and (coalesce(old.status, 'backlog') <> 'concluido'
          or coalesce(old.aguardando_validacao, false) = true) then
    raise exception 'Aluno nao pode validar a propria conclusao';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bloquear_conclusao on public.tarefas;
create trigger trg_bloquear_conclusao
  before insert or update on public.tarefas
  for each row
  execute function public.bloquear_conclusao_sem_validacao();

-- 4) HISTORICO: aluno registra atividade de tarefas da propria equipe
--    (ex.: mover card de companheiro de equipe, solicitar validacao)
drop policy if exists "historico_insert_authenticated" on public.historico_atividades;
drop policy if exists "historico_insert_team_or_professor" on public.historico_atividades;
create policy "historico_insert_team_or_professor" on public.historico_atividades
  for insert to authenticated
  with check (
    public.is_professor()
    or usuario_id = auth.uid()
    or (
      tarefa_id is not null
      and exists (
        select 1 from public.tarefas t
        where t.id = tarefa_id
          and t.equipe_id in (select public.equipes_do_uid())
      )
    )
  );
