import React from 'react'

export function Badge({ tipo, children }) {
  const classes = {
    alta: 'bg-danger',
    media: 'bg-warning text-dark',
    baixa: 'bg-secondary',
    urgente: 'bg-danger text-white',
    concluido: 'bg-success',
    fazendo: 'bg-primary',
    revisao: 'bg-info text-dark',
    a_fazer: 'bg-secondary',
    backlog: 'bg-dark',
    VERDE: 'bg-success',
    AMARELO: 'bg-warning text-dark',
    VERMELHO: 'bg-danger',
    aluno: 'bg-primary',
    professor: 'bg-success',
    gestor: 'bg-dark'
  }
  const labelMap = {
    backlog: 'Backlog',
    a_fazer: 'A Fazer',
    fazendo: 'Em Andamento',
    revisao: 'Em Revisão',
    concluido: 'Concluído'
  }
  const label = labelMap[tipo] || children || tipo
  return <span className={`badge ${classes[tipo] || 'bg-secondary'} rounded-pill`}>{label}</span>
}