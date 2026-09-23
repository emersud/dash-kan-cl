import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { TeamBuilderModal } from '../components/teams/TeamBuilderModal.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { StudentThumb } from '../components/dashboard/StudentThumb.jsx'
import { isProfessor, equipeDoAluno, podeEditarEquipe } from '../utils/permissions.js'

export default function TeamsPage() {
  const { equipes, usuarios, setEquipes, usuarioLogado, setRadarAlunoId, setActivePage } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [editEquipe, setEditEquipe] = useState(null)
  const [expandida, setExpandida] = useState(null)
  const [confirmRemover, setConfirmRemover] = useState(null)

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const minhaEquipe = equipeDoAluno(equipes, usuarioLogado?.id)
  const equipesVisiveis = ehProfessor ? equipes : (minhaEquipe ? [minhaEquipe] : [])

  const openNova = () => {
    setEditEquipe(null)
    setShowModal(true)
  }

  const openEditar = (equipe) => {
    setEditEquipe(equipe)
    setShowModal(true)
  }

  const remover = async () => {
    await ds.removerEquipe(confirmRemover)
    setConfirmRemover(null)
    setEquipes(await ds.listarEquipes())
  }

  const getAluno = (id) => usuarios.find(u => u.id === id)

  const abrirRadarAluno = (alunoId) => {
    setRadarAlunoId(alunoId)
    setActivePage('radar')
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Equipes & Grupos</h4>
          <small className="text-muted-custom">Formação de equipes com mix multi-turma</small>
        </div>
        {ehProfessor && (
          <button className="btn btn-primary-theme" onClick={openNova}>
            <i className="bi bi-plus-lg me-1"></i>Nova Equipe
          </button>
        )}
      </div>

      {equipesVisiveis.length === 0 && (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-people fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">{ehProfessor ? 'Nenhuma equipe criada ainda. Clique em "Nova Equipe" para começar.' : 'Você ainda não foi alocado em nenhuma equipe.'}</p>
          </div>
        </div>
      )}

      <div className="row g-3">
        {equipesVisiveis.map(equipe => {
          const isOpen = expandida === equipe.id
          const podeEditar = podeEditarEquipe(usuarioLogado, equipe)
          return (
            <div className="col-md-6 col-xl-4" key={equipe.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle" style={{ width: 52, height: 52, backgroundColor: equipe.cor_hex, overflow: 'hidden' }}>
                      {equipe.logo_url
                        ? <img src={equipe.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <i className="bi bi-people-fill text-white fs-4"></i>}
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="mb-0">{equipe.nome}</h6>
                      <small className="text-muted-custom">{equipe.membros?.length || 0} membros</small>
                    </div>
                    <div className="d-flex gap-1">
                      {podeEditar && (
                        <button className="theme-toggle" onClick={() => openEditar(equipe)} title="Editar"><i className="bi bi-pencil"></i></button>
                      )}
                      {ehProfessor && (
                        <button className="theme-toggle text-danger" onClick={() => setConfirmRemover(equipe.id)} title="Excluir"><i className="bi bi-trash"></i></button>
                      )}
                    </div>
                  </div>

                  {equipe.github_url && (
                    <div className="mb-2 small">
                      <a href={equipe.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>
                        <i className="bi bi-github me-1"></i>{equipe.github_url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  <div className="d-flex flex-wrap gap-1 mb-3">
                    {equipe.membros?.map(m => {
                      const aluno = getAluno(m.aluno_id)
                      if (!aluno) return null
                      return (
                        <StudentThumb
                          key={m.aluno_id}
                          aluno={aluno}
                          onClickable={ehProfessor ? () => abrirRadarAluno(aluno.id) : null}
                        />
                      )
                    })}
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm flex-grow-1" onClick={() => setExpandida(isOpen ? null : equipe.id)}>
                      {isOpen ? <><i className="bi bi-chevron-up me-1"></i>Ocultar membros</> : <><i className="bi bi-chevron-down me-1"></i>Ver papéis</>}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3">
                      {equipe.membros?.map(m => (
                        <div key={m.aluno_id} className="d-flex justify-content-between align-items-center p-2 rounded mb-1" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                          <span className="small">{getAluno(m.aluno_id)?.nome || 'Aluno'}</span>
                          <Badge tipo="aluno">{m.papel_no_grupo}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <TeamBuilderModal
        key={editEquipe?.id || 'nova-equipe'}
        show={showModal}
        onClose={() => { setShowModal(false); setEditEquipe(null) }}
        equipeEdit={editEquipe}
        restrito={!ehProfessor}
      />

      {confirmRemover && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Excluir equipe</h5></div>
              <div className="modal-body">Tem certeza que deseja excluir esta equipe? As tarefas associadas também serão removidas.</div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmRemover(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={remover}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}