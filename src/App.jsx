import React, { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { Sidebar } from './components/common/Sidebar.jsx'
import StudentsPage from './pages/StudentsPage.jsx'
import TeamsPage from './pages/TeamsPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import BacklogPage from './pages/BacklogPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import KanbanPage from './pages/KanbanPage.jsx'
import RadarPage from './pages/RadarPage.jsx'
import DailyRegisterPage from './pages/DailyRegisterPage.jsx'
import StudentProfilePage from './pages/StudentProfilePage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import * as ds from './services/dataService.js'

const PAGES = {
  students: StudentsPage,
  teams: TeamsPage,
  projects: ProjectsPage,
  backlog: BacklogPage,
  dashboard: DashboardPage,
  kanban: KanbanPage,
  radar: RadarPage,
  daily: DailyRegisterPage,
  profile: StudentProfilePage,
  users: UsersPage
}

function Shell() {
  const { usuarioLogado, setUsuarioLogado, setRadarAlunoId, setBacklogProjetoId, activePage, setActivePage, refreshAll } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  // Bloqueia o scroll do fundo enquanto o drawer mobile está aberto
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  // Fecha o drawer com a tecla Escape
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const toggleTheme = () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    setTheme(newTheme)
  }

  if (!usuarioLogado) {
    return (
      <LoginPage
        onLoginSuccess={async () => {
          // Dados já com a sessão do usuário; ativa o Perfil em seguida.
          await refreshAll()
          setActivePage('profile')
        }}
      />
    )
  }

  const ActivePage = PAGES[activePage] || StudentsPage

  const handleLogout = () => {
    ds.sairSupabase()
    setUsuarioLogado(null)
    setRadarAlunoId(null)
    setBacklogProjetoId(null)
    setActivePage('students')
    setSidebarOpen(false)
  }

  const handleNavigate = (key) => {
    if (key !== 'radar') setRadarAlunoId(null)
    if (key !== 'backlog') setBacklogProjetoId(null)
    setActivePage(key)
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      {/* Topbar mobile: menu hambúrguer + marca + tema (visível só <992px) */}
      <header className="mobile-topbar">
        <button
          className="theme-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu de navegação"
          title="Abrir menu"
        >
          <i className="bi bi-list fs-5"></i>
        </button>
        <div className="d-flex align-items-center gap-2 flex-grow-1">
          <i className="bi bi-mortarboard-fill" style={{ color: 'var(--color-primary)' }}></i>
          <span className="fw-bold brand-text">EduProject</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Alternar tema" title="Alternar tema">
          <i className={`bi ${theme === 'light' ? 'bi-moon-fill' : 'bi-sun-fill'}`}></i>
        </button>
      </header>

      {/* Backdrop do drawer */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <div className="app-body">
        <Sidebar
          active={activePage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="app-main">
          <ActivePage key={activePage} />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
