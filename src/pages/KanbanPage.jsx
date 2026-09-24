import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { BoardKanban } from '../components/kanban/BoardKanban.jsx'
import { TaskDetailModal } from '../components/kanban/TaskDetailModal.jsx'
import * as ds from '../services/dataService.js'
import { isProfessor, equipesDoAluno } from '../utils/permissions.js'

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
  const [tarefaDetalhe, setTarefaDetalhe] = useState(null)

  // Quando projetos carregam depois da montagem, seleciona o primeiro.
  useEffect(() => {
    if (!projetoId && projetosVisiveis.length > 0) {
      setProjetoId(projetosVisiveis[0].id)
    } else if (projetoId && projetosVisiveis.length > 0 && !projetosVisiveis.some(p => p.id === projetoId)) {
      setProjetoId(projetosVisiveis[0].id)
    }
  }, [projetosVisiveis, projetoId])

  const projeto = projetosVisiveis.find(p => p.id === projetoId)

  const excluirTarefa = async (id) => {
    await ds.removerTarefa(id)
    setTarefaDetalhe(null)
    await refreshAll()
  }

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Kanban</h4>
          <small className="text-muted-custom">Quadro de 4 colunas com drag-and-drop e checklist</small>
        </div>
        <select className="form-select" style={{ width: 300 }} value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
          {projetosVisiveis.length === 0 && <option value="">Nenhum projeto</option>}
          {projetosVisiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

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
            {tarefas.filter(t => t.projeto_id === projetoId && (ehProfessor || idsMinhasEquipes.has(t.equipe_id))).length} tarefas
          </div>
          <BoardKanban
            projeto={projeto}
            onCardClick={setTarefaDetalhe}
            equipeFiltro={ehProfessor ? null : (equipePrincipal?.id || null)}
            idsEquipesAluno={ehProfessor ? null : idsMinhasEquipes}
          />
          <TaskDetailModal show={!!tarefaDetalhe} tarefa={tarefaDetalhe} onClose={() => setTarefaDetalhe(null)} onDelete={excluirTarefa} permitirExcluir={ehProfessor} permitirAprovar={ehProfessor} />
        </>
      )}
    </div>
  )
}