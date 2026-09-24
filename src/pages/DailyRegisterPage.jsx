import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { equipeDoAluno, isProfessor } from '../utils/permissions.js'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function calcularStreak(dailyRegisters, alunoId) {
  const datas = new Set(
    dailyRegisters
      .filter(d => d.aluno_id === alunoId)
      .map(d => d.data_checkin)
  )
  let streak = 0
  const d = new Date()
  while (true) {
    const chave = d.toISOString().slice(0, 10)
    if (datas.has(chave)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export default function DailyRegisterPage() {
  const { usuarioLogado, tarefas, equipes, usuarios, dailyRegisters, setDailyRegisters } = useApp()
  const [oQueFez, setOQueFez] = useState('')
  const [licao, setLicao] = useState('')
  const [impedimento, setImpedimento] = useState('')
  const [msg, setMsg] = useState('')
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState('')

  const ehProfessor = isProfessor(usuarioLogado?.papel)
  const alunoId = ehProfessor ? (alunoSelecionadoId || null) : usuarioLogado?.id
  const minhaEquipe = equipeDoAluno(equipes, alunoId)
  const streak = calcularStreak(dailyRegisters, alunoId)
  const fezCheckinHoje = dailyRegisters.some(d => d.aluno_id === alunoId && d.data_checkin === hojeISO())

  const tarefasAluno = tarefas.filter(t => t.aluno_id === alunoId)

  const dailiesEquipe = minhaEquipe
    ? dailyRegisters
        .filter(d => d.equipe_id === minhaEquipe.id)
        .sort((a, b) => (b.data_checkin || '').localeCompare(a.data_checkin || ''))
    : []

  const alunosProfessor = usuarios.filter(u => u.papel === 'aluno')

  const excluirDaily = async (id) => {
    await ds.removerDailyRegister(id)
    setDailyRegisters(await ds.listarDailyRegisters())
  }

  const registrarCheckin = async () => {
    if (!oQueFez.trim()) { setMsg('Informe o que você fez hoje para registrar o check-in.'); return }
    await ds.criarDailyRegister({
      equipe_id: minhaEquipe?.id || null,
      aluno_id: alunoId,
      data_checkin: hojeISO(),
      o_que_fez: oQueFez.trim(),
      licao_aprendida: licao.trim(),
      impedimento: impedimento.trim()
    })
    await ds.registrarAtividade({ usuario_id: alunoId, tipo_acao: 'daily_checkin', descricao: 'Check-in diário' })
    setOQueFez('')
    setLicao('')
    setImpedimento('')
    setMsg('Check-in registrado com sucesso! 🚀')
    setDailyRegisters(await ds.listarDailyRegisters())
  }

  const concluirTarefa = async (t) => {
    if (t.status === 'concluido') return
    await ds.atualizarTarefa(t.id, { status: 'concluido' })
    await ds.registrarAtividade({ usuario_id: alunoId, tipo_acao: 'movimentou_card', descricao: `Concluiu a tarefa "${t.titulo}"` })
    setDailyRegisters([...dailyRegisters])
  }

  const getNome = (id) => usuarios.find(u => u.id === id)?.nome || 'Aluno'

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Daily Register</h4>
          <small className="text-muted-custom">Check-in diário, tarefas e lições aprendidas</small>
        </div>
        {!ehProfessor && (
          <div className="badge rounded-pill fs-6" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', padding: '10px 14px' }}>
            {fezCheckinHoje ? '✅ Check-in de hoje feito' : <span style={{ color: 'var(--color-secondary)' }}>🔥 {streak} {streak === 1 ? 'dia' : 'dias'} seguidos</span>}
          </div>
        )}
      </div>

      {ehProfessor && (
        <div className="card mb-4">
          <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
            <h6 className="mb-0"><i className="bi bi-person-lines-fill me-2" style={{ color: 'var(--color-primary)' }}></i>Selecionar Aluno</h6>
          </div>
          <div className="card-body">
            <select className="form-select" style={{ maxWidth: 400 }} value={alunoSelecionadoId} onChange={(e) => setAlunoSelecionadoId(e.target.value)}>
              <option value="">— selecione um aluno —</option>
              {alunosProfessor.map(a => (
                <option key={a.id} value={a.id}>{a.nome} — {equipeDoAluno(equipes, a.id)?.nome || 'sem equipe'}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!alunoId ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-rocket-takeoff fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">{ehProfessor ? 'Selecione um aluno acima para visualizar seus check-ins.' : 'Você ainda não foi alocado em nenhuma equipe.'}</p>
          </div>
        </div>
      ) : (
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-check2-circle me-2" style={{ color: 'var(--color-primary)' }}></i>{ehProfessor ? 'Check-in Diário do Aluno' : 'Check-in Diário'}</h6>
            </div>
            <div className="card-body">
              {msg && <div className="alert alert-success py-2 small">{msg}</div>}
              {!ehProfessor && !minhaEquipe && <div className="alert alert-warning py-2 small">Você ainda não está em nenhuma equipe.</div>}
              {ehProfessor ? (
                <>
                  <p className="text-muted-custom small mb-3">
                    Selecione um aluno acima para ver os check-ins. Como professor você pode excluir lições/impedimentos impróprios no feed da equipe.
                  </p>
                  <div className="alert alert-secondary py-2 small">
                    <i className="bi bi-info-circle me-1"></i>O registro de check-in é feito pelo aluno.
                  </div>
                </>
              ) : (
                <>
                  <label className="form-label text-muted-custom small">O que você fez hoje?</label>
                  <textarea className="form-control mb-3" rows={2} placeholder="Ex: Finalizei o protótipo..." value={oQueFez} onChange={(e) => setOQueFez(e.target.value)}></textarea>
                  <label className="form-label text-muted-custom small">Lições aprendidas ({licao.length}/280)</label>
                  <textarea className="form-control mb-3" rows={2} maxLength={280} placeholder="Ex: Aprendi a tratar RLS no Supabase..." value={licao} onChange={(e) => setLicao(e.target.value)}></textarea>
                  <label className="form-label text-muted-custom small">Impedimentos / Bloqueios</label>
                  <textarea className="form-control mb-3" rows={2} placeholder="Ex: Aguardando design system..." value={impedimento} onChange={(e) => setImpedimento(e.target.value)}></textarea>
                  <button className="btn btn-primary-theme w-100" onClick={registrarCheckin}>
                    <i className="bi bi-rocket-takeoff me-1"></i>Fazer Check-in de Hoje
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-list-task me-2" style={{ color: 'var(--color-primary)' }}></i>{ehProfessor ? 'Tarefas do Aluno' : 'Minhas Tarefas Rápidas'}</h6>
            </div>
            <div className="card-body">
              {tarefasAluno.length === 0 ? (
                <p className="text-muted-custom small mb-0">{ehProfessor ? 'Nenhuma tarefa atribuída a este aluno.' : 'Nenhuma tarefa atribuída a você.'}</p>
              ) : tarefasAluno.map(t => (
                <div key={t.id} className="d-flex align-items-center justify-content-between p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div className={`small ${t.status === 'concluido' ? 'text-decoration-line-through text-muted-custom' : ''}`}>{t.titulo}</div>
                    <small className="text-muted-custom">{t.status === 'concluido' ? 'Concluída' : 'Pendente'}</small>
                  </div>
                  {!ehProfessor && t.status !== 'concluido' && (
                    <button className="btn btn-success btn-sm" onClick={() => concluirTarefa(t)}><i className="bi bi-check-lg me-1"></i>Concluir</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-journal-text me-2" style={{ color: 'var(--color-primary)' }}></i>Lições Aprendidas — {minhaEquipe?.nome || 'Equipe'}</h6>
            </div>
            <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
              {dailiesEquipe.length === 0 ? (
                <p className="text-muted-custom small mb-0">Nenhum registro da equipe ainda.</p>
              ) : dailiesEquipe.map(d => (
                <div key={d.id} className="p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <strong className="small">{getNome(d.aluno_id)}</strong>
                    <div className="d-flex align-items-center gap-2">
                      <small className="text-muted-custom">{d.data_checkin}</small>
                      {ehProfessor && (
                        <button className="btn btn-danger btn-sm" title="Excluir registro (lição imprópria)" onClick={() => excluirDaily(d.id)}><i className="bi bi-trash"></i></button>
                      )}
                    </div>
                  </div>
                  <div className="small mb-1"><span className="text-muted-custom">Fez: </span>{d.o_que_fez}</div>
                  {d.licao_aprendida && <div className="small mb-1"><span className="text-muted-custom">Lição: </span>{d.licao_aprendida}</div>}
                  {d.impedimento && <div className="small"><span className="text-danger">⚠ </span>{d.impedimento}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}