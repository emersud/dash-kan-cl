import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import * as ds from '../../services/dataService.js'
import { Badge } from '../common/Badge.jsx'

const PRIO_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa', urgente: 'Urgente' }

export function TaskDetailModal({ show, tarefa, onClose, onDelete, permitirExcluir = true, permitirAprovar = false }) {
  const { usuarios, refreshAll, usuarioLogado } = useApp()
  const [novoItem, setNovoItem] = useState('')

  if (!show || !tarefa) return null

  const ehProfessor = usuarioLogado?.papel === 'professor' || usuarioLogado?.papel === 'gestor'
  const aluno = usuarios.find(u => u.id === tarefa.aluno_id)

  // Histórico ligado à tarefa (permite RLS por equipe) e com autor como fallback.
  const logAtividade = (tipo_acao, descricao) => ds.registrarAtividade({
    usuario_id: tarefa.aluno_id || usuarioLogado?.id,
    tarefa_id: tarefa.id,
    tipo_acao,
    descricao
  })

  const aprovarConcluida = async () => {
    // Somente professor/gestor insere a flag de concluída (validação final)
    if (!ehProfessor) return
    await ds.atualizarTarefa(tarefa.id, { status: 'concluido', aguardando_validacao: false })
    await logAtividade('aprovou_conclusao', `${usuarioLogado?.papel === 'gestor' ? 'Gestor' : 'Professor'} aprovou "${tarefa.titulo}" como concluída`)
    await refreshAll()
    onClose()
  }

  // Flag manual do professor/gestor: marca a tarefa como concluída sem passar pela aprovação.
  const marcarConcluida = async () => {
    if (!ehProfessor) return
    await ds.atualizarTarefa(tarefa.id, { status: 'concluido', aguardando_validacao: false })
    await logAtividade('aprovou_conclusao', `${usuarioLogado?.papel === 'gestor' ? 'Gestor' : 'Professor'} definiu "${tarefa.titulo}" como concluída (flag)`)
    await refreshAll()
    onClose()
  }

  const toggleChecklist = async (item) => {
    const novaLista = tarefa.checklists.map(c => c.id === item.id ? { ...c, concluido: !c.concluido } : c)
    const novoConcluido = novaLista.find(c => c.id === item.id).concluido
    await ds.atualizarTarefa(tarefa.id, { checklists: novaLista })
    if (novoConcluido) {
      await logAtividade('concluiu_checklist', `Concluiu o item "${item.item}"`)
    }
    await refreshAll()
  }

  const adicionarChecklist = async () => {
    if (!novoItem.trim()) return
    const novaLista = [...(tarefa.checklists || []), { id: 'c_' + Date.now(), item: novoItem.trim(), concluido: false }]
    await ds.atualizarTarefa(tarefa.id, { checklists: novaLista })
    setNovoItem('')
    await refreshAll()
  }

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{tarefa.titulo}</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex gap-2 mb-3 flex-wrap">
              <Badge tipo={tarefa.prioridade}>{PRIO_LABEL[tarefa.prioridade] || tarefa.prioridade}</Badge>
              <Badge tipo={tarefa.status}></Badge>
            </div>

            {tarefa.aguardando_validacao && (
              <div className={`alert py-2 small ${ehProfessor ? 'alert-warning' : 'alert-info'}`}>
                {ehProfessor ? (
                  <><i className="bi bi-hourglass-split me-1"></i>
                  Esta tarefa aguarda <strong>sua validação</strong>. O aluno enviou como concluída — clique em "Aprovar como Concluída" para inserir a flag de concluído.</>
                ) : (
                  <><i className="bi bi-hourglass-split me-1"></i>
                  Esta tarefa está <strong>em análise</strong>. Você solicitou a conclusão — aguarde a aprovação do professor/gestor.</>
                )}
              </div>
            )}

            {ehProfessor && permitirAprovar && tarefa.status !== 'concluido' && !tarefa.aguardando_validacao && (
              <div className="alert alert-info py-2 small">
                <i className="bi bi-flag me-1"></i>
                A conclusão só é efetiva com a <strong>flag do professor/gestor</strong> — use "Marcar como Concluída".
              </div>
            )}

            {tarefa.descricao && (
              <p className="text-muted-custom mb-3">{tarefa.descricao}</p>
            )}

            <div className="mb-3">
              <small className="text-muted-custom d-block mb-1"><i className="bi bi-person-fill me-1"></i>Responsável</small>
              <div className="d-flex align-items-center gap-2">
                {aluno ? (
                  <>
                    <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 28, height: 28, backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '0.7rem' }}>
                      {aluno.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <span>{aluno.nome}</span>
                  </>
                ) : <span className="text-muted-custom">Sem responsável</span>}
              </div>
            </div>

            <div className="mb-3">
              <small className="text-muted-custom d-block mb-1"><i className="bi bi-calendar-event me-1"></i>Prazo</small>
              <span>{tarefa.prazo_limite ? new Date(tarefa.prazo_limite).toLocaleString('pt-BR') : 'Sem prazo definido'}</span>
            </div>

            <div className="mb-2">
              <small className="text-muted-custom d-block mb-2"><i className="bi bi-check2-square me-1"></i>Checklist ({tarefa.checklists?.filter(c => c.concluido).length || 0}/{tarefa.checklists?.length || 0})</small>
              <div className="d-flex gap-2 mb-2">
                <input className="form-control form-control-sm" placeholder="Novo item..." value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarChecklist()} />
                <button className="btn btn-primary-theme btn-sm" onClick={adicionarChecklist}><i className="bi bi-plus-lg"></i></button>
              </div>
              {(tarefa.checklists || []).map(c => (
                <div key={c.id} className="d-flex align-items-center gap-2 p-2 rounded mb-1" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <input type="checkbox" checked={c.concluido} onChange={() => toggleChecklist(c)} />
                  <span className={`flex-grow-1 small ${c.concluido ? 'text-decoration-line-through text-muted-custom' : ''}`}>{c.item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer d-flex justify-content-between flex-wrap gap-2">
            <div className="d-flex gap-2 flex-wrap">
              {ehProfessor && permitirAprovar && tarefa.aguardando_validacao && (
                <button className="btn btn-success btn-sm" onClick={aprovarConcluida}>
                  <i className="bi bi-check2-circle me-1"></i>Aprovar como Concluída
                </button>
              )}
              {ehProfessor && permitirAprovar && tarefa.status !== 'concluido' && (
                <button className="btn btn-primary-theme btn-sm" onClick={marcarConcluida} title="Insere a flag de conclusão (validação final)">
                  <i className="bi bi-flag-fill me-1"></i>Marcar como Concluída
                </button>
              )}
              {permitirExcluir && ehProfessor && (
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(tarefa.id)}>
                  <i className="bi bi-trash me-1"></i>Excluir
                </button>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}