import React from 'react'
import { useApp } from '../../context/AppContext.jsx'

const STATUS_CONFIG = {
  verde: { cor: '#14c16e', label: 'No prazo' },
  amarelo: { cor: '#f59e0b', label: 'Em andamento' },
  vermelho: { cor: '#ef4444', label: 'Em atraso' },
  sem: { cor: '#64748b', label: 'Sem tarefas' }
}

export function StudentThumb({ aluno, onClickable }) {
  const { tarefas } = useApp()
  const tarefasAluno = tarefas.filter(t => t.aluno_id === aluno.id)

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

  const cfg = STATUS_CONFIG[status]
  const iniciais = aluno.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      className="d-flex flex-column align-items-center gap-1 p-2 rounded"
      title={`${aluno.nome} — ${cfg.label}`}
      onClick={onClickable}
      style={{ cursor: onClickable ? 'pointer' : 'default', backgroundColor: onClickable ? 'var(--bg-card-hover)' : 'transparent' }}
    >
      <div className="position-relative">
        <div className="rounded-circle d-flex align-items-center justify-content-center overflow-hidden" style={{ width: 44, height: 44, backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem' }}>
          {aluno.avatar_url
            ? <img src={aluno.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : iniciais}
        </div>
        <span className="position-absolute bottom-0 end-0 rounded-circle border border-white" style={{ width: 13, height: 13, backgroundColor: cfg.cor }}></span>
      </div>
      <small className="text-muted-custom text-center" style={{ fontSize: '0.68rem', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aluno.nome.split(' ')[0]}</small>
    </div>
  )
}