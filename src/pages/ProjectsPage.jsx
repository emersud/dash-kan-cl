import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { ProjectForm } from '../components/projects/ProjectForm.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { isProfessor, podeVerProjeto } from '../utils/permissions.js'

export default function ProjectsPage() {
  const { projetos, tarefas, equipes, usuarioLogado, setBacklogProjetoId, setActivePage } = useApp()
  const [showProjeto, setShowProjeto] = useState(false)
  const [editProjeto, setEditProjeto] = useState(null)
  const [confirmRemoverProjeto, setConfirmRemoverProjeto] = useState(null)

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const projetosVisiveis = projetos.filter(p => podeVerProjeto(usuarioLogado, p, equipes))

  const openNovaProjeto = () => { setEditProjeto(null); setShowProjeto(true) }
  const openEditarProjeto = (p) => { setEditProjeto(p); setShowProjeto(true) }

  const removerProjeto = async () => {
    await ds.removerProjeto(confirmRemoverProjeto)
    setConfirmRemoverProjeto(null)
  }

  const getEquipe = (id) => equipes.find(e => e.id === id)

  const abrirBacklog = (projeto) => {
    setBacklogProjetoId(projeto.id)
    setActivePage('backlog')
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Projetos</h4>
          <small className="text-muted-custom">Gerenciar projetos e vincular equipes</small>
        </div>
        {ehProfessor && (
          <button className="btn btn-primary-theme" onClick={openNovaProjeto}>
            <i className="bi bi-plus-lg me-1"></i>Novo Projeto
          </button>
        )}
      </div>

      {projetosVisiveis.length === 0 && (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-kanban fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">{ehProfessor ? 'Nenhum projeto cadastrado. Clique em "Novo Projeto".' : 'Nenhum projeto vinculado à sua equipe.'}</p>
          </div>
        </div>
      )}

      <div className="row g-3">
        {projetosVisiveis.map(projeto => {
          const projTarefas = tarefas.filter(t => t.projeto_id === projeto.id)
          const concluidas = projTarefas.filter(t => t.status === 'concluido').length
          const percentual = projTarefas.length ? Math.round((concluidas / projTarefas.length) * 100) : 0
          const equipesProjeto = (projeto.equipes_ids || []).map(getEquipe).filter(Boolean)
          return (
            <div className="col-md-6 col-xl-4" key={projeto.id}>
              <div className="card h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="mb-0"><i className="bi bi-kanban me-2" style={{ color: 'var(--color-primary)' }}></i>{projeto.nome}</h6>
                      <small className="text-muted-custom">
                        {projeto.data_inicio ? `Início ${new Date(projeto.data_inicio).toLocaleDateString('pt-BR')} · ` : ''}Entrega {projeto.data_entrega ? new Date(projeto.data_entrega).toLocaleDateString('pt-BR') : '—'}
                      </small>
                    </div>
                    {ehProfessor && (
                      <div className="d-flex gap-1">
                        <button className="theme-toggle" onClick={() => openEditarProjeto(projeto)} title="Editar"><i className="bi bi-pencil"></i></button>
                        <button className="theme-toggle text-danger" onClick={() => setConfirmRemoverProjeto(projeto.id)} title="Excluir"><i className="bi bi-trash"></i></button>
                      </div>
                    )}
                  </div>

                  {projeto.descricao && (
                    <p className="text-muted-custom small mb-2">{projeto.descricao}</p>
                  )}

                  <div className="mb-3">
                    <small className="text-muted-custom d-block mb-1">Equipes vinculadas</small>
                    <div className="d-flex flex-wrap gap-1">
                      {equipesProjeto.length === 0 ? (
                        <span className="badge bg-secondary">Nenhuma equipe</span>
                      ) : equipesProjeto.map(eq => (
                        <span key={eq.id} className="badge rounded-pill" style={{ backgroundColor: eq.cor_hex, color: '#fff' }}>
                          <i className="bi bi-people-fill me-1"></i>{eq.nome}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="d-flex justify-content-between mb-1 small">
                      <span className="text-muted-custom">{projTarefas.length} tarefa(s)</span>
                      <span className="fw-bold">{percentual}%</span>
                    </div>
                    <div className="progress" style={{ height: 8, backgroundColor: 'var(--bg-badge)' }}>
                      <div className="progress-bar" style={{ width: `${percentual}%` }}></div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <button className="btn btn-primary-theme btn-sm w-100" onClick={() => abrirBacklog(projeto)}>
                      <i className="bi bi-list-task me-1"></i>Gerenciar Backlog
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ProjectForm
        key={editProjeto?.id || 'novo-projeto'}
        show={showProjeto}
        onClose={() => { setShowProjeto(false); setEditProjeto(null) }}
        projetoEdit={editProjeto}
      />

      {confirmRemoverProjeto && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Excluir projeto</h5></div>
              <div className="modal-body">Excluir este projeto também removerá todas as tarefas associadas. Continuar?</div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmRemoverProjeto(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={removerProjeto}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}