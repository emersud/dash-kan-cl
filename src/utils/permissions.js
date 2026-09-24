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