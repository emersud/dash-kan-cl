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

  // Filtragem por equipe:
  // - Aluno: SEMPRE limitado às equipes em que participa (idsEquipesAluno)
  // - Professor/Gestor: respeita equipeFiltro (null = todas; id = equipe específica)
  const passaFiltro = (t) => {
    if (idsEquipesAluno) return idsEquipesAluno.has(t.equipe_id)
    if (equipeFiltro) return t.equipe_id === equipeFiltro
    return true
  }
  const tarefasProjeto = tarefas.filter(t => t.projeto_id === projeto.id && passaFiltro(t))

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const tarefa = tarefas.find(t => t.id === draggableId)
    if (!tarefa) return

    // BLINDAGEM: aluno só mexe em cards da própria equipe
    if (!ehProfessor && idsEquipesAluno && !idsEquipesAluno.has(tarefa.equipe_id)) return

    const novaStatus = destination.droppableId

    // REGRA: flag "concluída" (validada, sem pendência) só é inserida por professor/gestor.
    // Aluno que arrasta para "Concluído" apenas SOLICITA validação (aguardando_validacao=true)
    // e o card permanece "em análise" até o professor aprovar.
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
      // Professor/gestor valida e insere a flag de concluída de fato
      const atualizada = { ...tarefa, status: 'concluido', aguardando_validacao: false }
      setTarefas(tarefas.map(t => t.id === draggableId ? atualizada : t))
      await ds.atualizarTarefa(draggableId, { status: 'concluido', aguardando_validacao: false })
      await ds.registrarAtividade({
        usuario_id: tarefa.aluno_id,
        tipo_acao: 'movimentou_card',
        descricao: `${usuarioLogado?.papel === 'gestor' ? 'Gestor' : 'Professor'} validou a tarefa "${tarefa.titulo}" como concluída`
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
      // Movimentação entre colunas (backlog/a_fazer/fazendo): aluno e professor podem,
      // mas SAIR de "concluído" ou alterar validação exige professor/gestor.
      const saindoDeConcluido = source.droppableId === 'concluido'
      if (saindoDeConcluido && !ehProfessor) return

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