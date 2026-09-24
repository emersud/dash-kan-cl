import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { TeamHealthCard } from '../components/dashboard/TeamHealthCard.jsx'
import { StudentStatusDot } from '../components/dashboard/StudentStatusDot.jsx'

export default function DashboardPage() {
  const { projetos, equipes, usuarios, tarefas } = useApp()
  const [projetoId, setProjetoId] = useState(projetos[0]?.id || '')
  const [equipeId, setEquipeId] = useState('all')

  const projeto = projetos.find(p => p.id === projetoId)
  const equipesProjeto = projeto ? (projeto.equipes_ids || []).map(id => equipes.find(e => e.id === id)).filter(Boolean) : []
  const equipeAtiva = equipeId === 'all' ? null : equipes.find(e => e.id === equipeId)

  const tarefasFiltradas = tarefas.filter(t =>
    t.projeto_id === projetoId &&
    (equipeId === 'all' || t.equipe_id === equipeId)
  )
  const tarefasConcluidas = tarefasFiltradas.filter(t => t.status === 'concluido').length
  const percentual = tarefasFiltradas.length ? Math.round((tarefasConcluidas / tarefasFiltradas.length) * 100) : 0

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Dashboard</h4>
          <small className="text-muted-custom">KPIs de saúde das equipes e semáforo dos alunos</small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          <select className="form-select" style={{ width: 240 }} value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            {projetos.length === 0 && <option value="">Nenhum projeto</option>}
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className="form-select" style={{ width: 200 }} value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
            <option value="all">Todas as equipes</option>
            {equipesProjeto.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
          </select>
        </div>
      </div>

      {!projeto ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-clipboard-data fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">Crie um projeto na tela "Projetos & Backlog" para visualizar o dashboard.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="card">
                <div className="card-body d-flex align-items-center gap-3">
                  <i className="bi bi-kanban fs-2" style={{ color: 'var(--color-primary)' }}></i>
                  <div><div className="fs-4 fw-bold">{tarefasFiltradas.length}</div><small className="text-muted-custom">Tarefas</small></div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card">
                <div className="card-body d-flex align-items-center gap-3">
                  <i className="bi bi-check-circle-fill fs-2 text-success"></i>
                  <div><div className="fs-4 fw-bold">{tarefasConcluidas}</div><small className="text-muted-custom">Concluídas</small></div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card">
                <div className="card-body d-flex align-items-center gap-3">
                  <i className="bi bi-speedometer2 fs-2" style={{ color: 'var(--color-secondary)' }}></i>
                  <div><div className="fs-4 fw-bold">{percentual}%</div><small className="text-muted-custom">Conclusão global</small></div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card">
                <div className="card-body d-flex align-items-center gap-3">
                  <i className="bi bi-exclamation-triangle-fill fs-2 text-danger"></i>
                  <div>
                    <div className="fs-4 fw-bold">{tarefasFiltradas.filter(t => t.status !== 'concluido' && t.prazo_limite && new Date(t.prazo_limite) < new Date()).length}</div>
                    <small className="text-muted-custom">Atrasadas</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            {equipesProjeto.map(eq => (
              <div className="col-md-6 col-xl-3" key={eq.id}>
                <TeamHealthCard equipe={eq} />
              </div>
            ))}
          </div>

          {equipeAtiva && (
            <div className="card mb-4">
              <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                <h6 className="mb-0"><i className="bi bi-traffic-light me-2" style={{ color: 'var(--color-primary)' }}></i>Semáforo dos Alunos — {equipeAtiva.nome}</h6>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-3">
                  {(equipeAtiva.membros || []).map(m => {
                    const aluno = usuarios.find(u => u.id === m.aluno_id)
                    if (!aluno) return null
                    return (
                      <div key={m.aluno_id} className="d-flex align-items-center gap-2 badge rounded-pill" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-primary)', padding: '8px 12px' }}>
                        <StudentStatusDot alunoId={aluno.id} />
                        <span>{aluno.nome}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}