export function calcularScoreEngajamento(alunoId, tarefas, historicoAtividades) {
  const agora = new Date()

  const tarefasAluno = tarefas.filter(t => t.aluno_id === alunoId)
  const concluidas = tarefasAluno.filter(t => t.status === 'concluido').length
  const atrasadas = tarefasAluno.filter(t => t.status !== 'concluido' && new Date(t.prazo_limite) < agora).length
  const impedidas = tarefasAluno.filter(t => t.status === 'bloqueado' || t.is_impedida === true).length

  const historicoAluno = historicoAtividades.filter(h => h.usuario_id === alunoId)
  const comentarios = historicoAluno.filter(h => h.tipo_acao === 'comentou').length
  const checklists = historicoAluno.filter(h => h.tipo_acao === 'concluiu_checklist').length
  const dailyCheckins = historicoAluno.filter(h => h.tipo_acao === 'daily_checkin').length

  const ultimasAtividades = [...historicoAluno].sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))

  let diasSemAtividade = 0
  if (ultimasAtividades.length > 0) {
    const ultimaData = new Date(ultimasAtividades[0].data_hora)
    const diffTime = Math.abs(agora - ultimaData)
    diasSemAtividade = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  } else {
    diasSemAtividade = 7
  }

  const fatorPenalidadeOciosidade = diasSemAtividade > 3 ? diasSemAtividade * 1.5 : diasSemAtividade

  let scoreBruto =
    (concluidas * 4) +
    (dailyCheckins * 2) +
    (checklists * 2) +
    (comentarios * 1) -
    (atrasadas * 3) -
    (impedidas * 2) -
    fatorPenalidadeOciosidade

  const score = Math.max(0, Math.min(100, Math.round(scoreBruto)))

  let situacao = 'Protagônico'
  let badgeClass = 'badge-done'
  let corHex = '#14c16e'

  if (score < 25) {
    situacao = 'Crítica (Risco de Evasão/Carona)'
    badgeClass = 'badge-danger'
    corHex = '#ef4444'
  } else if (score < 55) {
    situacao = 'Atenção (Baixa Engajamento)'
    badgeClass = 'badge-pending'
    corHex = '#f59e0b'
  } else if (score < 80) {
    situacao = 'Boa Participação'
    badgeClass = 'badge-info'
    corHex = '#1686b9'
  }

  return {
    score,
    situacao,
    badgeClass,
    corHex,
    diasSemAtividade,
    metricas: {
      concluidas,
      atrasadas,
      dailyCheckins,
      checklists,
      comentarios,
      impedidas
    }
  }
}