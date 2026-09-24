import React from 'react'

const PRIO_CLASS = { alta: 'badge-danger', media: 'badge-pending', baixa: 'badge-neutral', urgente: 'badge-danger' }
const PRIO_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa', urgente: 'Urgente' }

export function TaskCard({ tarefa, aluno, onClick }) {
  const checkConcluidos = tarefa.checklists?.filter(c => c.concluido).length || 0
  const totalCheck = tarefa.checklists?.length || 0
  const atrasada = tarefa.status !== 'concluido' && tarefa.prazo_limite && new Date(tarefa.prazo_limite) < new Date()

  return (
    <div
      className="card mb-2"
      style={{ cursor: 'pointer', border: '1px solid var(--border-color)' }}
      onClick={() => onClick(tarefa)}
    >
      <div className="card-body p-2" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="d-flex justify-content-between align-items-start mb-1">
          <span className={`badge ${PRIO_CLASS[tarefa.prioridade] || 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
            {PRIO_LABEL[tarefa.prioridade] || tarefa.prioridade}
          </span>
          <div className="d-flex align-items-center gap-1">
            {tarefa.estimativa && (
              <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }} title="Estimativa">{tarefa.estimativa}</span>
            )}
            {atrasada && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}><i className="bi bi-exclamation-triangle-fill me-1"></i>Atrasada</span>}
          </div>
        </div>

        {tarefa.aguardando_validacao && (
          <div className="alert alert-warning py-1 px-2 mb-2 small d-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
            <i className="bi bi-hourglass-split"></i> Em análise
          </div>
        )}

        <h6 className="mb-1" style={{ fontSize: '0.85rem' }}>{tarefa.titulo}</h6>

        {tarefa.descricao && (
          <p className="text-muted-custom mb-1" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tarefa.descricao}
          </p>
        )}

        {totalCheck > 0 && (
          <div className="d-flex align-items-center gap-1 mb-1">
            <i className="bi bi-check2-square" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}></i>
            <small className="text-muted-custom" style={{ fontSize: '0.7rem' }}>{checkConcluidos}/{totalCheck}</small>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mt-1">
          <span className="text-muted-custom" style={{ fontSize: '0.7rem' }}>
            {tarefa.prazo_limite ? new Date(tarefa.prazo_limite).toLocaleDateString('pt-BR') : ''}
          </span>
          {aluno?.avatar_url ? (
            <img src={aluno.avatar_url} alt="" className="rounded-circle" style={{ width: 24, height: 24, objectFit: 'cover' }} />
          ) : (
            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 24, height: 24, backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '0.65rem' }}>
              {aluno ? aluno.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() : '?'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}