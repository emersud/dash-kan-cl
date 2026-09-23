import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { calcularScoreEngajamento } from '../../utils/engagementRadar.js'

export function EngagementRadarTable({ equipe }) {
  const { tarefas, usuarios, historico } = useApp()
  const membros = (equipe.membros || [])
    .map(m => {
      const aluno = usuarios.find(u => u.id === m.aluno_id)
      if (!aluno) return null
      return { ...aluno, papel: m.papel_no_grupo }
    })
    .filter(Boolean)

  const tarefasEquipe = tarefas.filter(t => t.equipe_id === equipe.id)

  return (
    <div className="table-responsive">
      <table className="table table-hover table-sm mb-0">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Papel</th>
            <th>Score</th>
            <th>Situação</th>
            <th>Inatividade</th>
          </tr>
        </thead>
        <tbody>
          {membros.map(aluno => {
            const eng = calcularScoreEngajamento(aluno.id, tarefasEquipe, historico)
            return (
              <tr key={aluno.id}>
                <td><i className="bi bi-person-circle me-1" style={{ color: 'var(--color-primary)' }}></i>{aluno.nome}</td>
                <td><span className="badge" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>{aluno.papel}</span></td>
                <td className="fw-bold">{eng.score}</td>
                <td><span className={`badge ${eng.badgeClass}`}>{eng.situacao}</span></td>
                <td className="text-muted-custom">{eng.diasSemAtividade}d</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}