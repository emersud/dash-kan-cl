import React from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import { Column } from './Column.jsx'
import { useApp } from '../../context/AppContext.jsx'
import * as ds from '../../services/dataService.js'
import { isProfessor } from '../../utils/permissions.js'

const COLUNAS = [
  { id: 'backlog', titulo: 'Backlog' },
  { id: 'a_fazer', titulo: 'A Fazer' },
  { id: 'fazendo', titulo: 'Em Andamento' },
  { id: 'concluido', titulo: 'Concluído' }
]

export function BoardKanban({ projeto, onCardClick, equipeFiltro = null, idsEquipesAluno = null }) {
  const { tarefas, usuarios, setTarefas, refreshAll, usuarioLogado } = useApp()
  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const passaFiltro = (t) => {
    if (ehProfessor || (!equipeFiltro && !idsEquipesAluno)) return true
    if (idsEquipesAluno) return idsEquipesAluno.has(t.equipe_id)
    return t.equipe_id === equipeFiltro
  }
  const tarefasProjeto = tarefas.filter(t => t.projeto_id === projeto.id && passaFiltro(t))

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const tarefa = tarefas.find(t => t.id === draggableId)
    const novaStatus = destination.droppableId

    if (novaStatus === 'concluido' && !ehProfessor) {
      const atualizada = { ...tarefa, status: 'concluido', aguardando_validacao: true }
      setTarefas(tarefas.map(t => t.id === draggableId ? atualizada : t))
      await ds.atualizarTarefa(draggableId, { status: 'concluido', aguardando_validacao: true })
      await ds.registrarAtividade({
        usuario_id: tarefa.aluno_id,
        tipo_acao: 'movimentou_card',
        descricao: `Aluno solicitou validação de "${tarefa.titulo}" (em análise)`
      })
      await refreshAll()
      return
    }

    if (novaStatus === 'concluido' && ehProfessor) {
      const atualizada = { ...tarefa, status: 'concluido', aguardando_validacao: false }
      setTarefas(tarefas.map(t => t.id === draggableId ? atualizada : t))
      await ds.atualizarTarefa(draggableId, { status: 'concluido', aguardando_validacao: false })
      await ds.registrarAtividade({
        usuario_id: tarefa.aluno_id,
        tipo_acao: 'movimentou_card',
        descricao: `Validou a tarefa "${tarefa.titulo}" como concluída`
      })
      await refreshAll()
      return
    }

    if (source.droppableId === destination.droppableId) {
      const col = tarefas.filter(t => t.projeto_id === projeto.id && t.status === novaStatus && passaFiltro(t))
      const reordered = Array.from(col)
      const [removida] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, removida)
      const all = tarefas.filter(t => !(t.projeto_id === projeto.id && t.status === novaStatus && passaFiltro(t)))
      setTarefas([...all, ...reordered])
    } else {
      const updated = { ...tarefa, status: novaStatus, aguardando_validacao: false }
      setTarefas(tarefas.map(t => t.id === draggableId ? updated : t))
      await ds.atualizarTarefa(draggableId, { status: novaStatus, aguardando_validacao: false })
      await ds.registrarAtividade({
        usuario_id: updated.aluno_id,
        tipo_acao: 'movimentou_card',
        descricao: `Moveu o card "${updated.titulo}" para ${novaStatus}`
      })
      await refreshAll()
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="kanban-board row g-3 flex-nowrap overflow-auto pb-2">
        {COLUNAS.map(col => (
          <Column
            key={col.id}
            id={col.id}
            titulo={col.titulo}
            tarefas={tarefasProjeto.filter(t => t.status === col.id)}
            alunos={usuarios}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DragDropContext>
  )
}