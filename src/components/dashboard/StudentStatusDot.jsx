import React from 'react'
import { useApp } from '../../context/AppContext.jsx'

export function StudentStatusDot({ alunoId }) {
  const { tarefas } = useApp()
  const tarefasAluno = tarefas.filter(t => t.aluno_id === alunoId)

  let status = 'sem'
  if (tarefasAluno.length === 0) {
    status = 'sem'
  } else {
    const concluidas = tarefasAluno.filter(t => t.status === 'concluido')
    const andamento = tarefasAluno.filter(t => t.status === 'fazendo' || t.status === 'revisao')
    const atrasadas = tarefasAluno.filter(t => t.status !== 'concluido' && t.prazo_limite && new Date(t.prazo_limite) < new Date())

    if (concluidas.length === tarefasAluno.length) {
      status = 'verde'
    } else if (atrasadas.length > 0 || andamento.length === 0) {
      status = 'vermelho'
    } else {
      status = 'amarelo'
    }
  }

  const config = {
    verde: { cor: '#14c16e', label: 'Concluído', icon: 'bi-circle-fill' },
    amarelo: { cor: '#eab308', label: 'Em Andamento', icon: 'bi-circle-fill' },
    vermelho: { cor: '#ef4444', label: 'Pendente/Atrasado', icon: 'bi-circle-fill' },
    sem: { cor: '#64748b', label: 'Sem tarefas', icon: 'bi-circle' }
  }

  const c = config[status]
  return <i className={`bi ${c.icon}`} style={{ color: c.cor }} title={c.label}></i>
}