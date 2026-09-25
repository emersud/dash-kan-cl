import React, { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'

const STATUS_CONFIG = {
  verde: { cor: '#14c16e', label: 'No prazo' },
  amarelo: { cor: '#f59e0b', label: 'Em andamento' },
  vermelho: { cor: '#ef4444', label: 'Em atraso' },
  sem: { cor: '#64748b', label: 'Sem tarefas' }
}

function calcularStatus(tarefas, alunoId) {
  const tarefasAluno = tarefas.filter(t => t.aluno_id === alunoId)
  if (tarefasAluno.length === 0) return 'sem'

  const concluidas = tarefasAluno.filter(t => t.status === 'concluido').length
  if (concluidas === tarefasAluno.length) return 'verde'

  const andamento = tarefasAluno.some(t => t.status === 'fazendo' || t.status === 'revisao')
  const atrasadas = tarefasAluno.some(t => t.status !== 'concluido' && t.prazo_limite && new Date(t.prazo_limite) < new Date())

  if (atrasadas || !andamento) return 'vermelho'
  return 'amarelo'
}

// Memoizado: em telas com muitos membros, cada atualização do contexto
// re-renderizava TODOS os thumbs e recalculava 3 filtros sobre todas as tarefas.
export const StudentThumb = React.memo(function StudentThumb({ aluno, onSelect }) {
  const { tarefas } = useApp()
  const status = useMemo(() => calcularStatus(tarefas, aluno.id), [tarefas, aluno.id])

  const cfg = STATUS_CONFIG[status]
  const iniciais = aluno.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      className="d-flex flex-column align-items-center gap-1 p-2 rounded"
      title={`${aluno.nome} — ${cfg.label}`}
      onClick={onSelect ? () => onSelect(aluno.id) : undefined}
      style={{ cursor: onSelect ? 'pointer' : 'default', backgroundColor: onSelect ? 'var(--bg-card-hover)' : 'transparent' }}
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
})
