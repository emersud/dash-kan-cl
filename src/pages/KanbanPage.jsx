import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { BoardKanban } from '../components/kanban/BoardKanban.jsx'
import { TaskDetailModal } from '../components/kanban/TaskDetailModal.jsx'
import * as ds from '../services/dataService.js'
import { isProfessor, equipesDoAluno, podeEditarTarefa, tarefasPendentesValidacao } from '../utils/permissions.js'

export default function KanbanPage() {
  const { projetos, tarefas, equipes, usuarioLogado, refreshAll } = useApp()
  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const minhasEquipes = equipesDoAluno(equipes, usuarioLogado?.id)
  const idsMinhasEquipes = new Set(minhasEquipes.map(e => e.id))
  const equipePrincipal = minhasEquipes[0] || null
  const projetosVisiveis = ehProfessor
    ? projetos
    : projetos.filter(p =>
        (p.equipes_ids || []).some(id => idsMinhasEquipes.has(id)) ||
        tarefas.some(t => t.aluno_id === usuarioLogado?.id && t.projeto_id === p.id)
      )

  const [projetoId, setProjetoId] = useState(projetosVisiveis[0]?.id || '')
  const [equipeFiltroId, setEquipeFiltroId] = useState('all')
  const [tarefaDetalhe, setTarefaDetalhe] = useState(null)

  // Quando projetos carregam depois da montagem, seleciona o primeiro.
  useEffect(() => {
    if (!projetoId && projetosVisiveis.length > 0) {
      setProjetoId(projetosVisiveis[0].id)
    } else if (projetoId && projetosVisiveis.length > 0 && !projetosVisiveis.some(p => p.id === projetoId)) {
      setProjetoId(projetosVisiveis[0].id)
    }
  }, [projetosVisiveis, projetoId])

  // Reset do filtro de equipe quando troca de projeto
  useEffect(() => {
    setEquipeFiltroId('all')
  }, [projetoId])

  const projeto = projetosVisiveis.find(p => p.id === projetoId)

  // Equipes disponíveis para o filtro do professor/gestor:
  // prioriza equipes vinculadas ao projeto selecionado; se nenhuma, mostra todas.
  const equipesVisiveisFiltro = ehProfessor
    ? (() => {
        const idsProjeto = new Set(projeto?.equipes_ids || [])
        const doProjeto = equipes.filter(e => idsProjeto.has(e.id))
        return doProjeto.length > 0 ? doProjeto : equipes
      })()
    : []

  // Filtro efetivo de equipe: professor escolhe (all ou id); aluno = sempre as suas equipes
  const equipeFiltro = ehProfessor
    ? (equipeFiltroId === 'all' ? null : equipeFiltroId)
    : (equipePrincipal?.id || null)
  const idsEquipesAluno = ehProfessor ? null : idsMinhasEquipes

  const excluirTarefa = async (id) => {
    // Aluno só exclui tarefas das equipes em que participa
    const tarefa = tarefas.find(t => t.id === id)
    if (!tarefa || !podeEditarTarefa(usuarioLogado, tarefa, equipes)) return
    await ds.removerTarefa(id)
    setTarefaDetalhe(null)
    await refreshAll()
  }

  const tarefasVisiveis = tarefas.filter(t =>
    t.projeto_id === projetoId &&
    (ehProfessor
      ? (equipeFiltroId === 'all' || t.equipe_id === equipeFiltroId)
      : idsMinhasEquipes.has(t.equipe_id)
    )
  )

  // Alerta para professor/gestor: concluídas pelo aluno, ainda sem flag
  const pendentesValidacao = ehProfessor ? tarefasPendentesValidacao(tarefasVisiveis) : []

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Kanban</h4>
          <small className="text-muted-custom">Quadro de 4 colunas com drag-and-drop e checklist</small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          <select className="form-select" style={{ width: 280 }} value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            {projetosVisiveis.length === 0 && <option value="">Nenhum projeto</option>}
            {projetosVisiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {ehProfessor && (
            <select
              className="form-select"
              style={{ width: 220 }}
              value={equipeFiltroId}
              onChange={(e) => setEquipeFiltroId(e.target.value)}
              title="Filtrar por equipe para acompanhar e validar"
            >
              <option value="all">Todas as equipes</option>
              {equipesVisiveisFiltro.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {pendentesValidacao.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <span>
            <i className="bi bi-hourglass-split me-2"></i>
            <strong>{pendentesValidacao.length}</strong> tarefa(s) concluída(s) aguardando <strong>validação</strong> — clique no card e aprove para inserir a flag.
          </span>
        </div>
      )}

      {!projeto ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-kanban fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">{ehProfessor ? 'Crie um projeto e tarefas na tela "Projetos & Backlog" para visualizar o kanban.' : 'Nenhum projeto vinculado à sua equipe.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 text-muted-custom small">
            {tarefasVisiveis.length} tarefa(s)
            {ehProfessor && equipeFiltroId !== 'all' && (
              <span> · equipe: {equipes.find(e => e.id === equipeFiltroId)?.nome || ''}</span>
            )}
            {!ehProfessor && minhasEquipes.length > 0 && (
              <span> · {minhasEquipes.map(e => e.nome).join(', ')}</span>
            )}
          </div>
          <BoardKanban
            projeto={projeto}
            onCardClick={setTarefaDetalhe}
            equipeFiltro={equipeFiltro}
            idsEquipesAluno={idsEquipesAluno}
          />
          <TaskDetailModal
            show={!!tarefaDetalhe}
            tarefa={tarefaDetalhe}
            onClose={() => setTarefaDetalhe(null)}
            onDelete={excluirTarefa}
            permitirExcluir={tarefaDetalhe ? podeEditarTarefa(usuarioLogado, tarefaDetalhe, equipes) : false}
            permitirAprovar={ehProfessor}
          />
        </>
      )}
    </div>
  )
}