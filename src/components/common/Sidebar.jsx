import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { isProfessor, tarefasPendentesValidacao } from '../../utils/permissions.js'

const NAV_ITEMS = [
  { key: 'profile', label: 'Perfil', icon: 'bi-person-circle' },
  { key: 'students', label: 'Turmas & Alunos', icon: 'bi-people-fill' },
  { key: 'teams', label: 'Equipes', icon: 'bi-people' },
  { key: 'projects', label: 'Projetos', icon: 'bi-clipboard-data' },
  { key: 'backlog', label: 'Backlog do Projeto', icon: 'bi-list-task' },
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', onlyProfessor: true },
  { key: 'kanban', label: 'Kanban', icon: 'bi-kanban', badgePendencias: true },
  { key: 'radar', label: 'Radar de Engajamento', icon: 'bi-radar', onlyProfessor: true },
  { key: 'daily', label: 'Daily Register', icon: 'bi-rocket-takeoff' },
  { key: 'users', label: 'Usuários', icon: 'bi-person-gear', onlyProfessor: true }
]

export function Sidebar({ active, onNavigate, onLogout, open, onClose }) {
  const { usuarioLogado, tarefas } = useApp()
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const itensVisiveis = NAV_ITEMS.filter(i => ehProfessor || !i.onlyProfessor)
  const pendentesValidacao = ehProfessor ? tarefasPendentesValidacao(tarefas).length : 0

  const toggleTheme = () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    setTheme(newTheme)
  }

  return (
    <div className={`sidebar p-0 ${open ? 'is-open' : ''}`}>
      <div className="p-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-mortarboard-fill fs-3" style={{ color: 'var(--color-primary)' }}></i>
          <div className="flex-grow-1">
            <div className="fw-bold brand-text">EduProject</div>
            <small className="text-muted-custom">Agile</small>
          </div>
          <button
            className="theme-toggle d-lg-none"
            onClick={onClose}
            aria-label="Fechar menu"
            title="Fechar menu"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
      <nav className="nav nav-pills flex-column p-2 gap-1">
        {itensVisiveis.map(item => (
          <button
            key={item.key}
            className={`nav-link text-start d-flex align-items-center gap-2 ${active === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.label}</span>
            {item.badgePendencias && pendentesValidacao > 0 && (
              <span
                className="badge rounded-pill ms-auto"
                style={{ backgroundColor: 'var(--badge-pending-bg)', color: 'var(--badge-pending-text)' }}
                title={`${pendentesValidacao} tarefa(s) concluída(s) aguardando validação`}
              >
                {pendentesValidacao}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="mt-auto p-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
        <div className="d-flex align-items-center gap-2 mb-3">
          <button className="theme-toggle" onClick={toggleTheme} title="Alternar tema">
            <i className={`bi ${theme === 'light' ? 'bi-moon-fill' : 'bi-sun-fill'}`}></i>
          </button>
          <span className="text-muted-custom small">{theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, backgroundColor: 'var(--color-primary)', color: '#fff' }}>
            <i className="bi bi-person-fill"></i>
          </div>
          <div className="flex-grow-1">
            <div className="small fw-bold brand-text">{usuarioLogado?.nome || 'Gestor'}</div>
            <small className="text-muted-custom">{usuarioLogado?.papel || 'gestor'}</small>
          </div>
          <button className="theme-toggle" onClick={onLogout} title="Sair">
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  )
}
