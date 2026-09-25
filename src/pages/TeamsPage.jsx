import React, { useState, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { TeamBuilderModal } from '../components/teams/TeamBuilderModal.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { StudentThumb } from '../components/dashboard/StudentThumb.jsx'
import { isProfessor, equipeDoAluno, podeEditarEquipe } from '../utils/permissions.js'

export default function TeamsPage() {
  const {
    equipes, usuarios, setEquipes,
    setTarefas,
    setProjetos,
    setDailyRegisters,
    refreshAll,
    usuarioLogado, setRadarAlunoId, setActivePage
  } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [editEquipe, setEditEquipe] = useState(null)
  const [expandida, setExpandida] = useState(null)
  const [confirmRemover, setConfirmRemover] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [erroRemocao, setErroRemocao] = useState(null)

  const ehProfessor = isProfessor(usuarioLogado?.papel)

  const usuariosPorId = useMemo(() => {
    const map = new Map()
    usuarios.forEach(u => map.set(u.id, u))
    return map
  }, [usuarios])

  const equipesVisiveis = useMemo(() => {
    if (ehProfessor) return equipes
    const minhaEquipe = equipeDoAluno(equipes, usuarioLogado?.id)
    return minhaEquipe ? [minhaEquipe] : []
  }, [equipes, ehProfessor, usuarioLogado])

  const openNova = () => {
    setEditEquipe(null)
    setShowModal(true)
  }

  const openEditar = (equipe) => {
    setEditEquipe(equipe)
    setShowModal(true)
  }

  // Exclusão com barra de progresso + remoção OTIMISTA: a equipe (e tudo que
  // dela depende) sai da tela no clique e a barra acompanha o serviço; o modal
  // só fecha em 100% ("Concluído!"). Se falhar, o alerta de erro é exibido e as
  // listas são recarregadas.
  const remover = async () => {
    const equipe = confirmRemover
    if (!equipe?.id || progresso) return
    const membros = equipe.membros?.length || 0

    setErroRemocao(null)
    setFeedback('')
    setProgresso({ etapa: 'preparando', atual: 0, total: 0 })

    setEquipes(prev => prev.filter(e => e.id !== equipe.id))
    setTarefas(prev => prev.map(t => (t.equipe_id === equipe.id ? { ...t, equipe_id: null } : t)))
    setProjetos(prev => prev.map(p => (p.equipes_ids?.includes(equipe.id) ? { ...p, equipes_ids: p.equipes_ids.filter(eid => eid !== equipe.id) } : p)))
    setDailyRegisters(prev => prev.filter(d => d.equipe_id !== equipe.id))

    try {
      await ds.removerEquipe(equipe.id, { onProgresso: setProgresso })
      setFeedback(`Equipe "${equipe.nome}" excluída com sucesso! ${membros} membro(s) desalocado(s) e as tarefas ficaram sem equipe.`)
      // mantém o 100% / "Concluído!" visíveis antes de fechar o modal
      await new Promise(resolve => setTimeout(resolve, 450))
    } catch (err) {
      console.error('[TeamsPage] falha ao excluir equipe:', err)
      setErroRemocao('Não foi possível excluir a equipe. Tente novamente.')
    } finally {
      setProgresso(null)
      setConfirmRemover(null)
      await refreshAll()
    }
  }

  // Percentual e texto da barra conforme a etapa recebida do serviço
  const progressoInfo = progresso ? (() => {
    const { etapa, atual = 0, total = 0 } = progresso
    if (etapa === 'vinculos') {
      const pct = total > 0 && atual > 0 ? 30 + Math.round((atual / total) * 60) : 60
      return {
        pct,
        texto: atual > 0
          ? `Removendo vínculos: ${atual} de ${total}...`
          : 'Removendo membros, check-ins e vínculos da equipe...'
      }
    }
    if (etapa === 'concluido') return { pct: 100, texto: 'Concluído!' }
    return { pct: 10, texto: 'Preparando a exclusão...' }
  })() : null

  const membrosConfirm = confirmRemover?.membros || []

  const getAluno = (id) => usuariosPorId.get(id)

  const abrirRadarAluno = useCallback((alunoId) => {
    setRadarAlunoId(alunoId)
    setActivePage('radar')
  }, [setRadarAlunoId, setActivePage])

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
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

      {erroRemocao && (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-exclamation-triangle me-2"></i>{erroRemocao}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={() => setErroRemocao(null)}>Fechar</button>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check-circle-fill me-2"></i>{feedback}</span>
          <button className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {!!progresso && !erroRemocao && (
        <div className="alert alert-info py-2 small mb-3">
          <i className="bi bi-arrow-repeat me-1"></i>Excluindo equipe... Não feche a página.
        </div>
      )}

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
                        <button
                          className="theme-toggle text-danger"
                          onClick={() => { setErroRemocao(null); setConfirmRemover(equipe) }}
                          disabled={!!progresso}
                          style={progresso ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          title="Excluir"
                        >
                          <i className={progresso ? 'bi bi-arrow-repeat' : 'bi bi-trash'}></i>
                        </button>
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
                          onSelect={ehProfessor ? abrirRadarAluno : null}
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

      {/* Confirmar exclusão de equipe (barra de progresso durante a exclusão) */}
      {confirmRemover && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {progresso
                    ? <><i className="bi bi-arrow-repeat me-2"></i>Excluindo equipe</>
                    : 'Excluir equipe'}
                </h5>
              </div>
              <div className="modal-body">
                {progresso ? (
                  <>
                    <p className="mb-3">
                      Excluindo <strong>{confirmRemover.nome}</strong>
                      {membrosConfirm.length > 0 ? <> e seus <strong>{membrosConfirm.length}</strong> membro(s)</> : ''}...
                    </p>
                    <div className="progress mb-2" style={{ height: 22 }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated"
                        role="progressbar"
                        style={{ width: `${progressoInfo.pct}%` }}
                        aria-valuenow={progressoInfo.pct}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        {progressoInfo.pct}%
                      </div>
                    </div>
                    <small className="text-muted-custom d-block">{progressoInfo.texto}</small>
                    <small className="text-muted-custom d-block mt-2">
                      <i className="bi bi-hourglass-split me-1"></i>Este processo pode levar alguns instantes. Não feche a página.
                    </small>
                  </>
                ) : (
                  <>
                    <p className="mb-2">
                      Tem certeza que deseja excluir a equipe <strong>{confirmRemover.nome}</strong>?
                      Esta ação não pode ser desfeita.
                    </p>
                    <p className="mb-0 text-muted-custom small">
                      Os membros, check-ins e vínculos serão removidos; as tarefas ficarão sem equipe.
                    </p>
                    {membrosConfirm.length > 0 && (
                      <ul className="small text-muted-custom mb-0 mt-2 ps-3">
                        {membrosConfirm.slice(0, 5).map(m => <li key={m.aluno_id}>{getAluno(m.aluno_id)?.nome || 'Aluno'}</li>)}
                        {membrosConfirm.length > 5 && <li>... e mais {membrosConfirm.length - 5} membro(s)</li>}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                {progresso ? (
                  <button className="btn btn-secondary" disabled>
                    <i className="bi bi-arrow-repeat me-1"></i>Aguarde...
                  </button>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => setConfirmRemover(null)}>Cancelar</button>
                    <button className="btn btn-danger" onClick={remover}>
                      <i className="bi bi-trash me-1"></i>Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}