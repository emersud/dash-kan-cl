import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { calcularScoreEngajamento } from '../utils/engagementRadar.js'
import { RadarGauge } from '../components/dashboard/RadarGauge.jsx'

export default function RadarPage() {
  const { projetos, equipes, usuarios, tarefas, historico, radarAlunoId } = useApp()
  const [projetoId, setProjetoId] = useState(projetos[0]?.id || '')
  const [equipeId, setEquipeId] = useState('')

  const projeto = projetos.find(p => p.id === projetoId)
  const equipesProjeto = projeto ? (projeto.equipes_ids || []).map(id => equipes.find(e => e.id === id)).filter(Boolean) : []
  const equipeAtiva = equipes.find(e => e.id === equipeId)

  const alunoSelecionado = radarAlunoId ? usuarios.find(u => u.id === radarAlunoId) : null
  const equipeDoAluno = equipes.find(e => (e.membros || []).some(m => m.aluno_id === radarAlunoId))
  const projetoDoAluno = projetos.find(p => (p.equipes_ids || []).includes(equipeDoAluno?.id))

  let membros = equipeAtiva
    ? (equipeAtiva.membros || [])
        .map(m => {
          const aluno = usuarios.find(u => u.id === m.aluno_id)
          if (!aluno) return null
          return { ...aluno, papel: m.papel_no_grupo }
        })
        .filter(Boolean)
    : []
  let tarefasEquipe = equipeAtiva ? tarefas.filter(t => t.equipe_id === equipeAtiva.id) : []

  if (alunoSelecionado && equipeDoAluno && !equipeAtiva) {
    membros = (equipeDoAluno.membros || [])
      .map(m => {
        const aluno = usuarios.find(u => u.id === m.aluno_id)
        if (!aluno) return null
        return { ...aluno, papel: m.papel_no_grupo }
      })
      .filter(Boolean)
    tarefasEquipe = tarefas.filter(t => t.equipe_id === equipeDoAluno.id)
  }

  const membrosVisiveis = alunoSelecionado ? membros.filter(m => m.id === alunoSelecionado.id) : membros

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Radar de Engajamento</h4>
          <small className="text-muted-custom">Score automático (0-100) com daily check-ins e impedimentos</small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          <select className="form-select" style={{ width: 240 }} value={projetoId} onChange={(e) => { setProjetoId(e.target.value); setEquipeId('') }}>
            {projetos.length === 0 && <option value="">Nenhum projeto</option>}
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className="form-select" style={{ width: 200 }} value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
            <option value="">Selecione a equipe</option>
            {equipesProjeto.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
          </select>
        </div>
      </div>

      {!projeto && !alunoSelecionado ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-radar fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">Crie um projeto para visualizar o radar de engajamento.</p>
          </div>
        </div>
      ) : !equipeAtiva && !alunoSelecionado ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-radar fs-1 d-block mb-3" style={{ color: 'var(--color-secondary)' }}></i>
            <p className="text-muted-custom mb-0">Selecione uma equipe acima para ver o score individual dos alunos.</p>
          </div>
        </div>
      ) : membrosVisiveis.length === 0 ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-radar fs-1 d-block mb-3" style={{ color: 'var(--color-secondary)' }}></i>
            <p className="text-muted-custom mb-0">Aluno não encontrado em nenhuma equipe.</p>
          </div>
        </div>
      ) : (
        <>
          {alunoSelecionado && (
            <div className="alert alert-info py-2">
              <i className="bi bi-person-badge me-1"></i>
              Radar individual de <strong>{alunoSelecionado.nome}</strong>
              {equipeDoAluno ? <> — Equipe {equipeDoAluno.nome}</> : ''}
              {projetoDoAluno ? <> | Projeto {projetoDoAluno.nome}</> : ''}
            </div>
          )}
          <div className="card mb-4">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-people-fill me-2" style={{ color: 'var(--color-primary)' }}></i>Gaúge Individual — {alunoSelecionado ? alunoSelecionado.nome : (equipeAtiva?.nome || 'Equipe')}</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {membrosVisiveis.map(aluno => {
                  const eng = calcularScoreEngajamento(aluno.id, tarefasEquipe, historico)
                  return (
                    <div className="col-6 col-md-3 col-xl-2" key={aluno.id}>
                      <div className="card h-100 text-center">
                        <div className="card-body d-flex flex-column align-items-center gap-2">
                          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 40, height: 40, backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '0.8rem' }}>
                            {aluno.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <strong className="small">{aluno.nome}</strong>
                          <RadarGauge score={eng.score} corHex={eng.corHex} situacao={eng.situacao} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-table me-2" style={{ color: 'var(--color-primary)' }}></i>Detalhamento por Aluno</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Papel</th>
                      <th>Score</th>
                      <th>Situação</th>
                      <th>Concluídas</th>
                      <th>Daily Check-ins</th>
                      <th>Checklists</th>
                      <th>Comentários</th>
                      <th>Atrasadas</th>
                      <th>Impedidas</th>
                      <th>Inatividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membrosVisiveis.map(aluno => {
                      const eng = calcularScoreEngajamento(aluno.id, tarefasEquipe, historico)
                      return (
                        <tr key={aluno.id}>
                          <td><i className="bi bi-person-circle me-1" style={{ color: 'var(--color-primary)' }}></i>{aluno.nome}</td>
                          <td><span className="badge" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>{aluno.papel}</span></td>
                          <td className="fw-bold">{eng.score}/100</td>
                          <td><span className={`badge ${eng.badgeClass}`}>{eng.situacao}</span></td>
                          <td>{eng.metricas.concluidas}</td>
                          <td>{eng.metricas.dailyCheckins}</td>
                          <td>{eng.metricas.checklists}</td>
                          <td>{eng.metricas.comentarios}</td>
                          <td className={eng.metricas.atrasadas > 0 ? 'text-danger fw-bold' : ''}>{eng.metricas.atrasadas}</td>
                          <td className={eng.metricas.impedidas > 0 ? 'text-warning fw-bold' : ''}>{eng.metricas.impedidas}</td>
                          <td className="text-muted-custom">{eng.diasSemAtividade}d</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}