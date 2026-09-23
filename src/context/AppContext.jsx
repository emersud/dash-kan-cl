import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import * as ds from '../services/dataService.js'

const AppContext = createContext(null)

export function useApp() {
  return useContext(AppContext)
}

export function AppProvider({ children }) {
  const [turmas, setTurmas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [equipes, setEquipes] = useState([])
  const [projetos, setProjetos] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [historico, setHistorico] = useState([])
  const [dailyRegisters, setDailyRegisters] = useState([])
  const [usuarioLogado, setUsuarioLogado] = useState(null)
  const [radarAlunoId, setRadarAlunoId] = useState(null)
  const [backlogProjetoId, setBacklogProjetoId] = useState(null)
  const [activePage, setActivePage] = useState('students')
  const [loading, setLoading] = useState(true)

  const refreshAll = useCallback(async () => {
    try {
      // allSettled: se UMA listagem falhar (RLS/rede), as demais ainda
      // atualizam o estado — evita tela vazia (ex.: Perfil sem projetos).
      const [t, u, e, p, ta, h, d] = await Promise.allSettled([
        ds.listarTurmas(),
        ds.listarUsuarios(),
        ds.listarEquipes(),
        ds.listarProjetos(),
        ds.listarTarefas(),
        ds.listarHistorico(),
        ds.listarDailyRegisters()
      ])
      if (t.status === 'fulfilled') setTurmas(t.value)
      if (u.status === 'fulfilled') setUsuarios(u.value)
      if (e.status === 'fulfilled') setEquipes(e.value)
      if (p.status === 'fulfilled') setProjetos(p.value)
      if (ta.status === 'fulfilled') setTarefas(ta.value)
      if (h.status === 'fulfilled') setHistorico(h.value)
      if (d.status === 'fulfilled') setDailyRegisters(d.value)
      const falhas = [t, u, e, p, ta, h, d]
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message || String(r.reason))
      if (falhas.length) console.warn('[refreshAll] falhas parciais:', falhas)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setUsuarioLogado(null)
    refreshAll()
  }, [refreshAll])

  const value = useMemo(() => ({
    turmas, setTurmas,
    usuarios, setUsuarios,
    equipes, setEquipes,
    projetos, setProjetos,
    tarefas, setTarefas,
    historico, setHistorico,
    dailyRegisters, setDailyRegisters,
    usuarioLogado,
    setUsuarioLogado,
    radarAlunoId, setRadarAlunoId,
    backlogProjetoId, setBacklogProjetoId,
    activePage, setActivePage,
    loading,
    refreshAll
  }), [turmas, usuarios, equipes, projetos, tarefas, historico, dailyRegisters, usuarioLogado, radarAlunoId, backlogProjetoId, activePage, loading, refreshAll])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}