import React from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { TaskCard } from './TaskCard.jsx'

const COL_STYLES = {
  backlog: { color: 'var(--status-todo)', bg: 'rgba(100,116,139,0.18)' },
  a_fazer: { color: 'var(--status-todo)', bg: 'rgba(118,187,248,0.12)' },
  fazendo: { color: 'var(--status-in-progress)', bg: 'rgba(20,193,110,0.12)' },
  concluido: { color: 'var(--status-done)', bg: 'rgba(22,134,185,0.15)' }
}

const COL_ICON = {
  backlog: '📥',
  a_fazer: '📋',
  fazendo: '⚙️',
  concluido: '✅'
}

const COL_TITLE = { backlog: 'Backlog', a_fazer: 'A Fazer', fazendo: 'Em Andamento', concluido: 'Concluído' }

export function Column({ id, titulo, tarefas, alunos, onCardClick }) {
  const st = COL_STYLES[id] || COL_STYLES.a_fazer
  return (
    <div className="col" style={{ minWidth: 280 }}>
      <div className="rounded p-2" style={{ backgroundColor: 'var(--bg-sidebar)', height: '100%' }}>
        <div className="d-flex justify-content-between align-items-center px-2 py-1 mb-2 rounded" style={{ backgroundColor: st.bg }}>
          <span className="fw-semibold small" style={{ color: st.color }}>{COL_ICON[id]} {titulo || COL_TITLE[id]}</span>
          <span className="badge rounded-pill" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>{tarefas.length}</span>
        </div>
        <Droppable droppableId={id}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ minHeight: 200 }}
            >
              {tarefas.map((t, index) => (
                <Draggable key={t.id} draggableId={t.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.85 : 1
                      }}
                    >
                      <TaskCard tarefa={t} aluno={alunos.find(a => a.id === t.aluno_id)} onClick={onCardClick} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  )
}