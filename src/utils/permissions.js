export const isProfessor = (papel) => papel === 'professor' || papel === 'gestor'

export function equipeDoAluno(equipes, alunoId) {
  return equipes.find(e => (e.membros || []).some(m => m.aluno_id === alunoId)) || null
}

export function equipesDoAluno(equipes, alunoId) {
  return equipes.filter(e => (e.membros || []).some(m => m.aluno_id === alunoId))
}

export function podeGerenciar(papel) {
  return isProfessor(papel)
}

export function podeEditarEquipe(usuario, equipe) {
  if (isProfessor(usuario?.papel)) return true
  return !!equipe && (equipe.membros || []).some(m => m.aluno_id === usuario?.id)
}

export function podeVerProjeto(usuario, projeto, equipes) {
  if (isProfessor(usuario?.papel)) return true
  if (!usuario) return false
  const minhas = equipesDoAluno(equipes, usuario.id)
  if (minhas.length === 0) return false
  const ids = new Set(minhas.map(e => e.id))
  return (projeto.equipes_ids || []).some(id => ids.has(id))
}

export function podeVerTarefa(usuario, tarefa, equipes) {
  if (isProfessor(usuario?.papel)) return true
  if (!usuario) return false
  const minhas = equipesDoAluno(equipes, usuario.id)
  const ids = new Set(minhas.map(e => e.id))
  return !!tarefa.equipe_id && ids.has(tarefa.equipe_id)
}

/**
 * Pode movimentar cards no Kanban da tarefa?
 * - Professor/Gestor: qualquer tarefa (todas as equipes).
 * - Aluno: apenas tarefas das equipes em que participa.
 */
export function podeMoverTarefaKanban(usuario, tarefa, equipes) {
  if (isProfessor(usuario?.papel)) return true
  if (!usuario || !tarefa) return false
  const minhas = equipesDoAluno(equipes, usuario.id)
  const ids = new Set(minhas.map(e => e.id))
  return !!tarefa.equipe_id && ids.has(tarefa.equipe_id)
}

/**
 * Pode inserir a flag de "concluída" (validação final sem pendência)?
 * Somente professor/gestor. Aluno apenas solicita (aguardando_validacao).
 */
export function podeValidarConclusao(papel) {
  return isProfessor(papel)
}

/**
 * Criar/editar projetos: exclusivo de professor/gestor.
 * Aluno não cria projetos — em nenhum caso.
 */
export function podeCriarProjeto(papel) {
  return isProfessor(papel)
}

/**
 * Criar tarefas no backlog:
 * - Professor/Gestor: qualquer projeto.
 * - Aluno: apenas projetos em que sua equipe participa.
 */
export function podeCriarTarefa(usuario, projeto, equipes) {
  if (!usuario || !projeto) return false
  if (isProfessor(usuario.papel)) return true
  return podeVerProjeto(usuario, projeto, equipes)
}

/**
 * Editar/excluir tarefas no backlog:
 * - Professor/Gestor: qualquer tarefa.
 * - Aluno: apenas tarefas das equipes em que participa (regra do grupo).
 */
export function podeEditarTarefa(usuario, tarefa, equipes) {
  if (!usuario || !tarefa) return false
  if (isProfessor(usuario.papel)) return true
  const ids = new Set(equipesDoAluno(equipes, usuario.id).map(e => e.id))
  return !!tarefa.equipe_id && ids.has(tarefa.equipe_id)
}

/**
 * Conclusão EFETIVA: só vale quando o professor/gestor inseriu a flag
 * (status 'concluido' sem pendência de validação).
 */
export function tarefaConcluida(tarefa) {
  return !!tarefa && tarefa.status === 'concluido' && !tarefa.aguardando_validacao
}

/**
 * Tarefa concluída pelo aluno e ainda aguardando a validação do professor/gestor.
 */
export function tarefaAguardandoValidacao(tarefa) {
  return !!tarefa && !!tarefa.aguardando_validacao
}

/**
 * Lista de tarefas pendentes de validação (alerta para professor/gestor).
 */
export function tarefasPendentesValidacao(tarefas) {
  return (tarefas || []).filter(tarefaAguardandoValidacao)
}

/**
 * Excluir usuário (tela Gerenciar Usuários):
 * - Gestor: exclui qualquer usuário (menos a si mesmo).
 * - Professor: exclui APENAS alunos — não pode excluir gestores nem outros
 *   professores (a regra também é imposta pela RPC e pelo RLS, migração 0008).
 * - Aluno: não exclui ninguém.
 */
export function podeExcluirUsuario(usuarioLogado, alvo) {
  if (!usuarioLogado || !alvo) return false
  if (alvo.id === usuarioLogado.id) return false
  if (!isProfessor(usuarioLogado.papel)) return false
  if (usuarioLogado.papel === 'gestor') return true
  return alvo.papel === 'aluno'
}