export function calcularSaudeEquipe(tarefasEquipe, integrantesEquipe) {
  const total = tarefasEquipe.length
  if (total === 0) {
    return { status: 'AMARELO', cor: 'warning', percentual: 0, mensagem: 'Nenhuma tarefa cadastrada' }
  }

  const concluidas = tarefasEquipe.filter(t => t.status === 'concluido').length
  const percentual = Math.round((concluidas / total) * 100)

  const agora = new Date()
  const atrasadas = tarefasEquipe.filter(t => t.status !== 'concluido' && new Date(t.prazo_limite) < agora)

  const alertas = []
  integrantesEquipe.forEach(aluno => {
    const tarefasAluno = tarefasEquipe.filter(t => t.aluno_id === aluno.id && t.status !== 'concluido')
    if (tarefasAluno.length === 0) {
      alertas.push({ tipo: 'ocioso', aluno: aluno.nome, msg: `${aluno.nome} está sem tarefas atribuídas.` })
    } else if (tarefasAluno.length > 5) {
      alertas.push({ tipo: 'sobrecarregado', aluno: aluno.nome, msg: `${aluno.nome} está sobrecarregado (${tarefasAluno.length} tarefas).` })
    }
  })

  let status = 'VERDE'
  let cor = 'success'

  if (percentual < 40 || atrasadas.length > 2 || alertas.length >= 2) {
    status = 'VERMELHO'
    cor = 'danger'
  } else if (percentual <= 75 || atrasadas.length > 0) {
    status = 'AMARELO'
    cor = 'warning'
  }

  return { status, cor, percentual, total, concluidas, atrasadas: atrasadas.length, alertas }
}