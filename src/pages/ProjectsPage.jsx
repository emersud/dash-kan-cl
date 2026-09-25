import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { ProjectForm } from '../components/projects/ProjectForm.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { isProfessor, podeVerProjeto, podeCriarProjeto, tarefasPendentesValidacao } from '../utils/permissions.js'

export default function ProjectsPage() {
  const { projetos, tarefas, equipes, usuarioLogado, setProjetos, setTarefas, refreshAll, setBacklogProjetoId, setActivePage } = useApp()
  const [showProjeto, setShowProjeto] = useState(false)
  const [editProjeto, setEditProjeto] = useState(null)
  const [confirmRemoverProjeto, setConfirmRemoverProjeto] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [erroRemocao, setErroRemocao] = useState(null)

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const projetosVisiveis = projetos.filter(p => podeVerProjeto(usuarioLogado, p, equipes))

  const openNovaProjeto = () => { setEditProjeto(null); setShowProjeto(true) }
  const openEditarProjeto = (p) => { setEditProjeto(p); setShowProjeto(true) }

  // Exclusão com barra de progresso (mesma diretriz da exclusão de turma):
  // o modal mostra a barra, o rodapé vira "Aguarde...", e ao final a tela
  // exibe a mensagem de sucesso — falha vira alerta removível em vez de travar.
  const removerProjeto = async () => {
    const projeto = confirmRemoverProjeto
    if (!projeto?.id || progresso) return
    const nome = projeto.nome || 'Projeto'
    const totalTarefas = tarefas.filter(t => t.projeto_id === projeto.id).length

    setErroRemocao(null)
    setFeedback('')
    setProgresso({ etapa: 'preparando', atual: 0, total: 0 })

    try {
      await ds.removerProjeto(projeto.id, { onProgresso: setProgresso })
      setProjetos(prev => prev.filter(p => p.id !== projeto.id))
      setTarefas(prev => prev.filter(t => t.projeto_id !== projeto.id))
      setFeedback(`Projeto "${nome}" excluído com sucesso! ${totalTarefas} tarefa(s) e seus checklists também foram removidos.`)
      // mantém o 100% / "Concluído!" visíveis antes de fechar o modal
      await new Promise(resolve => setTimeout(resolve, 450))
    } catch (err) {
      console.error('[ProjectsPage] falha ao excluir projeto:', err)
      setErroRemocao('Não foi possível excluir o projeto. Tente novamente.')
    } finally {
      setProgresso(null)
      setConfirmRemoverProjeto(null)
      await refreshAll()
    }
  }

  // Percentual e texto da barra conforme a etapa recebida do serviço
  const progressoInfo = progresso ? (() => {
    const { etapa, atual = 0, total = 0 } = progresso
    if (etapa === 'tarefas') {
      const pct = total > 0 && atual > 0 ? 30 + Math.round((atual / total) * 60) : 60
      return {
        pct,
        texto: atual > 0
          ? `Removendo tarefas: ${atual} de ${total}...`
          : 'Removendo tarefas, checklists e vínculos do projeto...'
      }
    }
    if (etapa === 'concluido') return { pct: 100, texto: 'Concluído!' }
    return { pct: 10, texto: 'Preparando a exclusão...' }
  })() : null

  const projetoConfirm = confirmRemoverProjeto || null
  const tarefasConfirm = confirmRemoverProjeto?.id
    ? tarefas.filter(t => t.projeto_id === confirmRemoverProjeto.id)
    : []

  const getEquipe = (id) => equipes.find(e => e.id === id)

  const abrirBacklog = (projeto) => {
    setBacklogProjetoId(projeto.id)
    setActivePage('backlog')
  }

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Projetos</h4>
          <small className="text-muted-custom">Gerenciar projetos e vincular equipes</small>
        </div>
        {podeCriarProjeto(usuarioLogado?.papel) && (
          <button className="btn btn-primary-theme" onClick={openNovaProjeto}>
            <i className="bi bi-plus-lg me-1"></i>Novo Projeto
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
          <i className="bi bi-arrow-repeat me-1"></i>Excluindo projeto... Não feche a página.
        </div>
      )}

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
          // Conclusão efetiva: só vale com a flag do professor/gestor
          const concluidas = projTarefas.filter(t => t.status === 'concluido' && !t.aguardando_validacao).length
          const pendentes = tarefasPendentesValidacao(projTarefas).length
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
                        <button className="theme-toggle text-danger" onClick={() => { setErroRemocao(null); setConfirmRemoverProjeto(projeto) }} disabled={!!progresso} style={progresso ? { opacity: 0.4, cursor: 'not-allowed' } : {}} title="Excluir"><i className={progresso ? 'bi bi-arrow-repeat' : 'bi bi-trash'}></i></button>
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
                        <span className="badge badge-neutral">Nenhuma equipe</span>
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
                    {pendentes > 0 && ehProfessor && (
                      <small className="badge badge-pending mt-2 d-inline-block" title="Concluídas pelo aluno, aguardando sua validação">
                        <i className="bi bi-hourglass-split me-1"></i>{pendentes} aguardando validação
                      </small>
                    )}
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

      {/* Confirmar exclusão de projeto (barra de progresso durante a exclusão) */}
      {confirmRemoverProjeto && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {progresso
                    ? <><i className="bi bi-arrow-repeat me-2"></i>Excluindo projeto</>
                    : 'Excluir projeto'}
                </h5>
              </div>
              <div className="modal-body">
                {progresso ? (
                  <>
                    <p className="mb-3">
                      Excluindo <strong>{projetoConfirm?.nome || 'projeto'}</strong>
                      {tarefasConfirm.length > 0 ? <> e <strong>{tarefasConfirm.length}</strong> tarefa(s)</> : ''}...
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
                      Tem certeza que deseja excluir o projeto <strong>{projetoConfirm?.nome || ''}</strong>?
                      Esta ação não pode ser desfeita.
                    </p>
                    <p className="mb-0 text-muted-custom small">
                      Excluir este projeto também removerá as {tarefasConfirm.length} tarefa(s) associadas e seus checklists.
                    </p>
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
                    <button className="btn btn-secondary" onClick={() => setConfirmRemoverProjeto(null)}>Cancelar</button>
                    <button className="btn btn-danger" onClick={removerProjeto}>
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