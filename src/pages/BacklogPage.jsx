import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { BacklogAssigner } from '../components/projects/BacklogAssigner.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { ThOrdenavel, useOrdenacao, ordenarPor } from '../components/common/TableSort.jsx'
import { isProfessor, equipesDoAluno, podeVerProjeto, podeCriarTarefa, podeEditarTarefa, tarefasPendentesValidacao } from '../utils/permissions.js'

const PRIO_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }

// Ordem lógica dos valores (asc = mais leve primeiro)
const ORDEM_PRIORIDADE = { baixa: 1, media: 2, alta: 3, urgente: 4 }
const ORDEM_STATUS = { backlog: 1, a_fazer: 2, fazendo: 3, revisao: 4, concluido: 5 }
// Estimativa: tamanhos (P/M/G) antes dos pontos numéricos
const ORDEM_ESTIMATIVA = { P: 1, M: 2, G: 3, '1': 4, '2': 5, '3': 6, '5': 7, '8': 8 }

export default function BacklogPage() {
  const { projetos, tarefas, equipes, usuarios, usuarioLogado, backlogProjetoId, setBacklogProjetoId, setActivePage, refreshAll } = useApp()
  const [projetoId, setProjetoId] = useState(backlogProjetoId || projetos[0]?.id || '')
  const [tarefaEdit, setTarefaEdit] = useState(null)
  const [showTarefa, setShowTarefa] = useState(false)
  const [confirmRemoverTarefa, setConfirmRemoverTarefa] = useState(null)
  const [ordem, ordenar] = useOrdenacao(null, 'asc')

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const minhasEquipes = equipesDoAluno(equipes, usuarioLogado?.id)
  const idsMinhasEquipes = useMemo(() => new Set(minhasEquipes.map(e => e.id)), [minhasEquipes])

  // Projetos acessíveis: aluno só vê projetos da própria equipe
  const projetosVisiveis = useMemo(
    () => projetos.filter(p => podeVerProjeto(usuarioLogado, p, equipes)),
    [projetos, usuarioLogado, equipes]
  )

  const projeto = projetosVisiveis.find(p => p.id === projetoId)
  // Aluno enxerga apenas as tarefas das equipes em que participa.
  const tarefasProjeto = useMemo(
    () => tarefas.filter(t => t.projeto_id === projetoId && (ehProfessor || idsMinhasEquipes.has(t.equipe_id))),
    [tarefas, projetoId, ehProfessor, idsMinhasEquipes]
  )

  // Mantém a seleção sempre dentro dos projetos acessíveis ao usuário
  useEffect(() => {
    if (projetosVisiveis.length === 0) return
    if (!projetosVisiveis.some(p => p.id === projetoId)) {
      setProjetoId(projetosVisiveis[0].id)
      setBacklogProjetoId(projetosVisiveis[0].id)
    }
  }, [projetosVisiveis, projetoId, setBacklogProjetoId])

  const podeCriar = podeCriarTarefa(usuarioLogado, projeto, equipes)
  const podeEditar = (t) => podeEditarTarefa(usuarioLogado, t, equipes)
  const pendentesValidacao = ehProfessor ? tarefasPendentesValidacao(tarefasProjeto) : []

  const equipesPorId = useMemo(() => {
    const map = new Map()
    equipes.forEach(e => map.set(e.id, e))
    return map
  }, [equipes])

  const usuariosPorId = useMemo(() => {
    const map = new Map()
    usuarios.forEach(u => map.set(u.id, u))
    return map
  }, [usuarios])

  // Ordenação por clique no cabeçalho (seta asc/desc)
  const ordenacaoTarefas = useMemo(() => ({
    titulo: t => t.titulo,
    prioridade: t => ORDEM_PRIORIDADE[t.prioridade] ?? null,
    estimativa: t => ORDEM_ESTIMATIVA[t.estimativa] ?? null,
    equipe: t => equipesPorId.get(t.equipe_id)?.nome || null,
    responsavel: t => usuariosPorId.get(t.aluno_id)?.nome || null,
    prazo: t => (t.prazo_limite ? new Date(t.prazo_limite).getTime() : null),
    status: t => ORDEM_STATUS[t.status] ?? null
  }), [equipesPorId, usuariosPorId])

  const tarefasVisiveis = useMemo(
    () => ordenarPor(tarefasProjeto, ordenacaoTarefas, ordem.campo, ordem.direcao),
    [tarefasProjeto, ordenacaoTarefas, ordem]
  )

  const openNovaTarefa = () => { setTarefaEdit(null); setShowTarefa(true) }
  const openEditarTarefa = (t) => { setTarefaEdit(t); setShowTarefa(true) }

  const removerTarefa = async () => {
    // Blindagem: aluno só exclui tarefas das equipes em que participa
    const t = tarefas.find(x => x.id === confirmRemoverTarefa)
    if (!t || !podeEditarTarefa(usuarioLogado, t, equipes)) {
      setConfirmRemoverTarefa(null)
      return
    }
    await ds.removerTarefa(confirmRemoverTarefa)
    setConfirmRemoverTarefa(null)
    await refreshAll()
  }

  const getEquipe = (id) => equipesPorId.get(id)
  const getAluno = (id) => usuariosPorId.get(id)

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Backlog do Projeto</h4>
          <small className="text-muted-custom">
            {ehProfessor
              ? 'Incluir e gerenciar tarefas do projeto selecionado'
              : 'Inclua e gerencie tarefas apenas das equipes em que você participa'}
          </small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          <select className="form-select" style={{ width: 280 }} value={projetoId} onChange={(e) => { setProjetoId(e.target.value); setBacklogProjetoId(e.target.value) }}>
            {projetosVisiveis.length === 0 && <option value="">Nenhum projeto</option>}
            {projetosVisiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {podeCriar && (
            <button className="btn btn-primary-theme" onClick={openNovaTarefa}>
              <i className="bi bi-plus-lg me-1"></i>Nova Tarefa
            </button>
          )}
        </div>
      </div>

      {pendentesValidacao.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <span>
            <i className="bi bi-hourglass-split me-2"></i>
            <strong>{pendentesValidacao.length}</strong> tarefa(s) concluída(s) aguardando <strong>sua validação</strong> — a conclusão só vale após o professor/gestor inserir a flag.
          </span>
          <button className="btn btn-sm btn-outline-warning" onClick={() => setActivePage('kanban')}>
            <i className="bi bi-kanban me-1"></i>Validar no Kanban
          </button>
        </div>
      )}

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
                    <ThOrdenavel campo="titulo" rotulo="Tarefa" ordem={ordem} onOrdenar={ordenar} />
                    <ThOrdenavel campo="prioridade" rotulo="Prioridade" ordem={ordem} onOrdenar={ordenar} />
                    <ThOrdenavel campo="estimativa" rotulo="Estim." ordem={ordem} onOrdenar={ordenar} />
                    <ThOrdenavel campo="equipe" rotulo="Equipe" ordem={ordem} onOrdenar={ordenar} />
                    <ThOrdenavel campo="responsavel" rotulo="Responsável" ordem={ordem} onOrdenar={ordenar} />
                    <ThOrdenavel campo="prazo" rotulo="Prazo" ordem={ordem} onOrdenar={ordenar} />
                    <ThOrdenavel campo="status" rotulo="Status" ordem={ordem} onOrdenar={ordenar} />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tarefasVisiveis.length === 0 ? (
                    <tr><td colSpan="8" className="text-center text-muted-custom py-3">Nenhuma tarefa no backlog deste projeto.</td></tr>
                  ) : tarefasVisiveis.map(t => {
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
                        <td>
                          <Badge tipo={t.status}></Badge>
                          {t.aguardando_validacao && (
                            <span className="badge badge-pending d-block mt-1" style={{ fontSize: '0.65rem' }} title="Concluída pelo aluno, ainda sem flag do professor/gestor">
                              <i className="bi bi-hourglass-split me-1"></i>Em análise
                            </span>
                          )}
                        </td>
                        <td>
                          {podeEditar(t) && (
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