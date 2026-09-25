import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { TeamHealthCard } from '../components/dashboard/TeamHealthCard.jsx'
import { StudentStatusDot } from '../components/dashboard/StudentStatusDot.jsx'
import { isProfessor, tarefasPendentesValidacao } from '../utils/permissions.js'

export default function DashboardPage() {
  const { projetos, equipes, usuarios, tarefas, usuarioLogado, setActivePage } = useApp()
  const [projetoId, setProjetoId] = useState(projetos[0]?.id || '')
  const [equipeId, setEquipeId] = useState('all')

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const projeto = projetos.find(p => p.id === projetoId)
  const equipesProjeto = projeto ? (projeto.equipes_ids || []).map(id => equipes.find(e => e.id === id)).filter(Boolean) : []
  const equipeAtiva = equipeId === 'all' ? null : equipes.find(e => e.id === equipeId)

  const tarefasFiltradas = tarefas.filter(t =>
    t.projeto_id === projetoId &&
    (equipeId === 'all' || t.equipe_id === equipeId)
  )
  // Conclusão EFETIVA: só conta com a flag do professor/gestor
  const tarefasConcluidas = tarefasFiltradas.filter(t => t.status === 'concluido' && !t.aguardando_validacao).length
  const percentual = tarefasFiltradas.length ? Math.round((tarefasConcluidas / tarefasFiltradas.length) * 100) : 0

  // Alerta global (todas as equipes/projetos): tarefas concluídas sem a flag
  const pendentesValidacao = ehProfessor ? tarefasPendentesValidacao(tarefas) : []
  const pendentesNoFiltro = pendentesValidacao.filter(t => t.projeto_id === projetoId)

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

      {pendentesValidacao.length > 0 && (
        <div className="alert alert-warning mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <i className="bi bi-hourglass-split me-2"></i>
              <strong>{pendentesValidacao.length}</strong> tarefa(s) concluída(s) <strong>aguardando sua validação</strong>
              {pendentesNoFiltro.length > 0 && pendentesNoFiltro.length !== pendentesValidacao.length && (
                <span className="text-muted-custom ms-1">({pendentesNoFiltro.length} neste projeto)</span>
              )}
              <div className="small mt-1">
                A conclusão só é efetiva quando o professor/gestor insere a flag de concluído.
              </div>
            </div>
            <button className="btn btn-sm btn-outline-warning" onClick={() => setActivePage('kanban')}>
              <i className="bi bi-kanban me-1"></i>Ir para o Kanban
            </button>
          </div>
          <div className="mt-2">
            {pendentesValidacao.slice(0, 6).map(t => (
              <div key={t.id} className="d-flex align-items-center gap-2 small py-1 border-top" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <i className="bi bi-check2-square"></i>
                <span className="fw-semibold">{t.titulo}</span>
                <span className="text-muted-custom ms-auto">
                  {equipes.find(e => e.id === t.equipe_id)?.nome || '—'} · {projetos.find(p => p.id === t.projeto_id)?.nome || '—'}
                </span>
              </div>
            ))}
            {pendentesValidacao.length > 6 && (
              <div className="small text-muted-custom mt-1">+ {pendentesValidacao.length - 6} outra(s) tarefa(s)…</div>
            )}
          </div>
        </div>
      )}

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