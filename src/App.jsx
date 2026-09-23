import React from 'react'
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
  }

  const handleNavigate = (key) => {
    if (key !== 'radar') setRadarAlunoId(null)
    if (key !== 'backlog') setBacklogProjetoId(null)
    setActivePage(key)
  }

  return (
    <div className="app-shell d-flex">
      <Sidebar active={activePage} onNavigate={handleNavigate} onLogout={handleLogout} />
      <div className="flex-grow-1 p-4">
        <ActivePage key={activePage} />
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