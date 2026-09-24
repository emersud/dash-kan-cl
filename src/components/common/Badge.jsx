import React from 'react'

export function Badge({ tipo, children }) {
  const classes = {
    alta: 'badge-danger',
    media: 'badge-pending',
    baixa: 'badge-neutral',
    pendente: 'badge-pending',
    urgente: 'badge-danger',
    concluido: 'badge-done',
    fazendo: 'badge-info',
    revisao: 'badge-neutral',
    a_fazer: 'badge-info',
    backlog: 'badge-neutral',
    VERDE: 'badge-done',
    AMARELO: 'badge-pending',
    VERMELHO: 'badge-danger',
    aluno: 'badge-info',
    professor: 'badge-done',
    gestor: 'badge-neutral'
  }
  const labelMap = {
    backlog: 'Backlog',
    a_fazer: 'A Fazer',
    fazendo: 'Em Andamento',
    revisao: 'Em Revisão',
    concluido: 'Concluído'
  }
  const label = labelMap[tipo] || children || tipo
  return <span className={`badge ${classes[tipo] || 'badge-neutral'} rounded-pill`}>{label}</span>
}
