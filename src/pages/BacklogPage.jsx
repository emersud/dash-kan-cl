import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { BacklogAssigner } from '../components/projects/BacklogAssigner.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { isProfessor, equipeDoAluno } from '../utils/permissions.js'

const PRIO_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }

export default function BacklogPage() {
  const { projetos, tarefas, equipes, usuarios, usuarioLogado, backlogProjetoId, setBacklogProjetoId } = useApp()
  const [projetoId, setProjetoId] = useState(backlogProjetoId || projetos[0]?.id || '')
  const [tarefaEdit, setTarefaEdit] = useState(null)
  const [showTarefa, setShowTarefa] = useState(false)
  const [confirmRemoverTarefa, setConfirmRemoverTarefa] = useState(null)

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const minhaEquipe = equipeDoAluno(equipes, usuarioLogado?.id)

  const projeto = projetos.find(p => p.id === projetoId)
  const tarefasProjeto = tarefas.filter(t => t.projeto_id === projetoId && (ehProfessor || t.equipe_id === minhaEquipe?.id))

  const openNovaTarefa = () => { setTarefaEdit(null); setShowTarefa(true) }
  const openEditarTarefa = (t) => { setTarefaEdit(t); setShowTarefa(true) }

  const removerTarefa = async () => {
    await ds.removerTarefa(confirmRemoverTarefa)
    setConfirmRemoverTarefa(null)
  }

  const getEquipe = (id) => equipes.find(e => e.id === id)
  const getAluno = (id) => usuarios.find(u => u.id === id)

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Backlog do Projeto</h4>
          <small className="text-muted-custom">Incluir e gerenciar tarefas do projeto selecionado</small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          <select className="form-select" style={{ width: 280 }} value={projetoId} onChange={(e) => { setProjetoId(e.target.value); setBacklogProjetoId(e.target.value) }}>
            {projetos.length === 0 && <option value="">Nenhum projeto</option>}
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {ehProfessor && (
            <button className="btn btn-primary-theme" onClick={openNovaTarefa}>
              <i className="bi bi-plus-lg me-1"></i>Nova Tarefa
            </button>
          )}
        </div>
      </div>

      {!projeto ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-list-task fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">Crie um projeto na tela "Projetos" para gerenciar seu backlog.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <h6 className="mb-0"><i className="bi bi-kanban me-2" style={{ color: 'var(--color-primary)' }}></i>{projeto.nome}</h6>
            <span className="badge" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>{tarefasProjeto.length} tarefa(s)</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0">
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Prioridade</th>
                    <th>Estim.</th>
                    <th>Equipe</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tarefasProjeto.length === 0 ? (
                    <tr><td colSpan="8" className="text-center text-muted-custom py-3">Nenhuma tarefa no backlog deste projeto.</td></tr>
                  ) : tarefasProjeto.map(t => {
                    const eq = getEquipe(t.equipe_id)
                    const al = getAluno(t.aluno_id)
                    return (
                      <tr key={t.id}>
                        <td>
                          <div className="fw-semibold">{t.titulo}</div>
                          {t.checklists?.length > 0 && (
                            <small className="text-muted-custom">
                              <i className="bi bi-check2-square me-1"></i>{t.checklists.filter(c => c.concluido).length}/{t.checklists.length} aceite
                            </small>
                          )}
                        </td>
                        <td><Badge tipo={t.prioridade}>{PRIO_LABEL[t.prioridade] || t.prioridade}</Badge></td>
                        <td className="text-muted-custom">{t.estimativa ? <span className="badge badge-neutral">{t.estimativa}</span> : '—'}</td>
                        <td><span style={{ color: eq?.cor_hex || 'var(--text-muted)' }}><i className="bi bi-people-fill me-1"></i>{eq?.nome || '—'}</span></td>
                        <td className="text-muted-custom"><i className="bi bi-person-circle me-1"></i>{al?.nome || '—'}</td>
                        <td className="text-muted-custom">{t.prazo_limite ? new Date(t.prazo_limite).toLocaleDateString('pt-BR') : '—'}</td>
                        <td><Badge tipo={t.status}></Badge></td>
                        <td>
                          {ehProfessor && (
                            <div className="d-flex gap-1">
                              <button className="theme-toggle" onClick={() => openEditarTarefa(t)} title="Editar"><i className="bi bi-pencil"></i></button>
                              <button className="theme-toggle text-danger" onClick={() => setConfirmRemoverTarefa(t.id)} title="Excluir"><i className="bi bi-trash"></i></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <BacklogAssigner
        key={tarefaEdit?.id || 'nova-tarefa'}
        show={showTarefa}
        onClose={() => { setShowTarefa(false); setTarefaEdit(null) }}
        projeto={projeto}
        tarefaEdit={tarefaEdit}
      />

      {confirmRemoverTarefa && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Excluir tarefa</h5></div>
              <div className="modal-body">Tem certeza que deseja excluir esta tarefa?</div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmRemoverTarefa(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={removerTarefa}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}