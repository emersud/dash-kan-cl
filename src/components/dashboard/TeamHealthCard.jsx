import React from 'react'
import { calcularSaudeEquipe } from '../../utils/healthCalculator.js'
import { useApp } from '../../context/AppContext.jsx'

const STATUS_ICON = {
  VERDE: 'bi-emoji-smile-fill',
  AMARELO: 'bi-emoji-neutral-fill',
  VERMELHO: 'bi-emoji-frown-fill'
}

export function TeamHealthCard({ equipe }) {
  const { tarefas, usuarios } = useApp()
  const tarefasEquipe = tarefas.filter(t => t.equipe_id === equipe.id)
  const membros = (equipe.membros || [])
    .map(m => usuarios.find(u => u.id === m.aluno_id))
    .filter(Boolean)
  const saude = calcularSaudeEquipe(tarefasEquipe, membros)

  return (
    <div className="card h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, backgroundColor: equipe.cor_hex, color: '#fff' }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <h6 className="mb-0">{equipe.nome}</h6>
          </div>
          <i className={`bi ${STATUS_ICON[saude.status]} fs-4 text-${saude.cor}`}></i>
        </div>

        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted-custom small">Conclusão</span>
          <span className="small fw-bold">{saude.percentual}%</span>
        </div>
        <div className="progress mb-3" style={{ height: 8, backgroundColor: 'var(--bg-badge)' }}>
          <div className={`progress-bar bg-${saude.cor}`} style={{ width: `${saude.percentual}%` }}></div>
        </div>

        <div className="d-flex gap-3 mb-2 small">
          <span className="text-muted-custom"><i className="bi bi-list-task me-1"></i>{saude.total} total</span>
          <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i>{saude.concluidas}</span>
          <span className="text-danger"><i className="bi bi-exclamation-circle-fill me-1"></i>{saude.atrasadas} atrasadas</span>
        </div>

        {saude.alertas.length > 0 && (
          <div>
            <small className="text-muted-custom d-block mb-1">Alertas:</small>
            {saude.alertas.slice(0, 3).map((a, i) => (
              <div key={i} className="alert alert-warning py-1 px-2 small mb-1">
                <i className="bi bi-bell-fill me-1"></i>{a.msg}
              </div>
            ))}
          </div>
        )}
        {saude.mensagem && <small className="text-muted-custom">{saude.mensagem}</small>}
      </div>
    </div>
  )
}