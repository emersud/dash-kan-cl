import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { isProfessor, equipesDoAluno } from '../utils/permissions.js'
import { PeerRadarChart } from '../components/peers/PeerRadarChart.jsx'
import { PeerEvaluationForm } from '../components/peers/PeerEvaluationForm.jsx'
import { PeriodoAvaliacaoModal } from '../components/peers/PeriodoAvaliacaoModal.jsx'
import {
  CRITERIOS,
  AVISO_CONFIDENCIALIDADE,
  MSG_SEM_DADOS,
  ESCALA,
  formatarMedia,
  temAlgumDado,
  avaliacaoDoPar,
  progressoDoAvaliador,
  painelParticipacao,
  mediaAggregadaGrupo,
  consolidarResultados,
  rotuloEstadoPeriodo,
  rotuloEstadoColega,
  badgeEstadoColega,
  periodoAberto
} from '../utils/peerEvaluation.js'

function iniciais(nome = '') {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function formatarData(valor) {
  if (!valor) return '—'
  const partes = String(valor).slice(0, 10).split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(valor)
}

function badgeEstadoPeriodo(estado) {
  return { aberto: 'badge-done', encerrado: 'badge-neutral', rascunho: 'badge-pending' }[estado] || 'badge-neutral'
}

export default function PeerEvaluationPage() {
  const { usuarioLogado, usuarios, equipes } = useApp()

  const [periodos, setPeriodos] = useState([])
  const [periodoId, setPeriodoId] = useState('')
  const [avaliacoes, setAvaliacoes] = useState([])
  const [resultados, setResultados] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroGeral, setErroGeral] = useState('')

  // Aluno: formulário
  const [colegaSelecionadoId, setColegaSelecionadoId] = useState(null)
  const [salvando, setSalvando] = useState(null)
  const [erroForm, setErroForm] = useState('')
  const [feedback, setFeedback] = useState('')

  // Professor: filtros e gestão de períodos
  const [equipeFiltro, setEquipeFiltro] = useState('')
  const [alunoResultadosId, setAlunoResultadosId] = useState(null)
  const [modalPeriodo, setModalPeriodo] = useState(false)
  const [periodoEdit, setPeriodoEdit] = useState(null)
  const [periodoExcluirId, setPeriodoExcluirId] = useState(null)

  const ehProfessor = isProfessor(usuarioLogado?.papel)

  const carregarDados = useCallback(async () => {
    setErroGeral('')
    try {
      const [p, a, r] = await Promise.allSettled([
        ds.listarPeriodosAvaliacao(),
        ds.listarPeerAvaliacoes(),
        ds.listarPeerResultados()
      ])
      if (p.status === 'fulfilled') setPeriodos(p.value)
      if (a.status === 'fulfilled') setAvaliacoes(a.value)
      if (r.status === 'fulfilled') setResultados(consolidarResultados(r.value))
      const falhas = [p, a, r].filter(x => x.status === 'rejected')
      if (falhas.length) {
        console.warn('[PeerEvaluation] falhas ao carregar:', falhas.map(f => f.reason?.message || String(f.reason)))
        setErroGeral('Não foi possível carregar os dados da avaliação por pares. Tente novamente.')
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  // Período padrão: o primeiro ABERTO (senão o último cadastrado).
  useEffect(() => {
    if (periodos.length === 0) return
    if (periodoId && periodos.some(p => p.id === periodoId)) return
    const aberto = periodos.find(p => p.estado === 'aberto') || periodos[periodos.length - 1]
    setPeriodoId(aberto?.id || '')
  }, [periodos, periodoId])

  const periodo = periodos.find(p => p.id === periodoId) || null

  // ------------------------------- ALUNO -------------------------------
  const minhasEquipes = useMemo(
    () => equipesDoAluno(equipes, usuarioLogado?.id),
    [equipes, usuarioLogado?.id]
  )

  const colegas = useMemo(() => {
    const mapa = new Map()
    for (const equipe of minhasEquipes) {
      for (const membro of equipe.membros || []) {
        if (membro.aluno_id === usuarioLogado?.id) continue
        const aluno = usuarios.find(u => u.id === membro.aluno_id)
        if (aluno && !mapa.has(aluno.id)) {
          mapa.set(aluno.id, { ...aluno, equipeNome: equipe.nome, equipeCor: equipe.cor_hex })
        }
      }
    }
    return [...mapa.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [minhasEquipes, usuarios, usuarioLogado?.id])

  const colegaSelecionado = colegas.find(c => c.id === colegaSelecionadoId) || null

  const progresso = useMemo(
    () => progressoDoAvaliador({
      avaliacoes,
      periodoId,
      avaliadorId: usuarioLogado?.id,
      colegasIds: colegas.map(c => c.id)
    }),
    [avaliacoes, periodoId, usuarioLogado?.id, colegas]
  )

  const minhaLinhaResultados = useMemo(
    () => resultados.find(r => r.periodo_id === periodoId && r.avaliado_id === usuarioLogado?.id) || null,
    [resultados, periodoId, usuarioLogado?.id]
  )

  const mediasRecebidas = useMemo(() => {
    if (!minhaLinhaResultados) return null
    const medias = {}
    for (const criterio of CRITERIOS) {
      medias[criterio.chave] = {
        media: minhaLinhaResultados[criterio.chave] ?? null,
        qtd: Number(minhaLinhaResultados[`${criterio.chave}_n`] || 0)
      }
    }
    return medias
  }, [minhaLinhaResultados])

  const evolucaoPeriodos = useMemo(() => {
    if (!usuarioLogado) return []
    const linhas = resultados.filter(r => r.avaliado_id === usuarioLogado.id && r.total_avaliacoes > 0)
    return linhas
      .map(linha => ({
        linha,
        periodo: periodos.find(p => p.id === linha.periodo_id) || null
      }))
      .filter(item => item.periodo)
      .sort((a, b) => String(a.periodo.data_inicio || '').localeCompare(String(b.periodo.data_inicio || '')))
  }, [resultados, periodos, usuarioLogado])

  // ----------------------------- PROFESSOR -----------------------------
  const alunosVisiveis = useMemo(() => {
    const membrosDaEquipe = (equipe) => new Set((equipe.membros || []).map(m => m.aluno_id))
    return usuarios
      .filter(u => u.papel === 'aluno')
      .filter(u => {
        if (!equipeFiltro) return true
        const equipe = equipes.find(e => e.id === equipeFiltro)
        return !!equipe && membrosDaEquipe(equipe).has(u.id)
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [usuarios, equipes, equipeFiltro])

  useEffect(() => {
    if (alunosVisiveis.length === 0) {
      if (alunoResultadosId !== null) setAlunoResultadosId(null)
      return
    }
    if (!alunosVisiveis.some(a => a.id === alunoResultadosId)) {
      setAlunoResultadosId(alunosVisiveis[0].id)
    }
  }, [alunosVisiveis, alunoResultadosId])

  const painel = useMemo(
    () => painelParticipacao({ avaliacoes, periodoId, alunos: alunosVisiveis, equipes }),
    [avaliacoes, periodoId, alunosVisiveis, equipes]
  )

  const linhaAlunoResultados = useMemo(
    () => resultados.find(r => r.periodo_id === periodoId && r.avaliado_id === alunoResultadosId) || null,
    [resultados, periodoId, alunoResultadosId]
  )

  const mediasAluno = useMemo(() => {
    if (!linhaAlunoResultados) return null
    const medias = {}
    for (const criterio of CRITERIOS) {
      medias[criterio.chave] = {
        media: linhaAlunoResultados[criterio.chave] ?? null,
        qtd: Number(linhaAlunoResultados[`${criterio.chave}_n`] || 0)
      }
    }
    return medias
  }, [linhaAlunoResultados])

  const mediasEquipe = useMemo(() => {
    if (!equipeFiltro) return null
    const linhas = resultados.filter(r => r.periodo_id === periodoId && r.equipe_id === equipeFiltro)
    if (linhas.length === 0) return null
    return mediaAggregadaGrupo(linhas)
  }, [resultados, periodoId, equipeFiltro])

  const comentariosAluno = useMemo(() => {
    if (!alunoResultadosId) return []
    return avaliacoes
      .filter(a => a.periodo_id === periodoId && a.avaliado_id === alunoResultadosId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }, [avaliacoes, periodoId, alunoResultadosId])

  const pendentesParticipacao = painel.filter(l => l.pendentes > 0)

  // ------------------------------ AÇÕES -------------------------------
  const abrirFormulario = (colegaId) => {
    setFeedback('')
    setErroForm('')
    setColegaSelecionadoId(colegaId)
  }

  const salvarAvaliacao = async ({ notas, comentario, enviar }) => {
    if (!periodoAberto(periodo)) {
      setErroForm('O período foi encerrado e não aceita alterações.')
      return
    }
    if (!colegaSelecionado) return
    const equipeComum = minhasEquipes.find(e =>
      (e.membros || []).some(m => m.aluno_id === colegaSelecionado.id)
    )
    setErroForm('')
    setSalvando(enviar ? 'envio' : 'rascunho')
    try {
      await ds.salvarPeerAvaliacao({
        periodo_id: periodoId,
        equipe_id: equipeComum?.id || null,
        avaliador_id: usuarioLogado.id,
        avaliado_id: colegaSelecionado.id,
        ...notas,
        comentario: (comentario || '').trim()
      }, { enviar })
      await carregarDados()
      if (enviar) {
        setFeedback(`Avaliação de ${colegaSelecionado.nome} enviada com sucesso.`)
        setColegaSelecionadoId(null)
      } else {
        setFeedback('Rascunho salvo. Ele só entra nas médias quando for enviado.')
      }
    } catch (e) {
      console.warn('[PeerEvaluation] salvar:', e?.message || e)
      setErroForm(e?.message || 'Não foi possível salvar a avaliação. Tente novamente.')
    } finally {
      setSalvando(null)
    }
  }

  const salvarPeriodo = async () => { await carregarDados() }

  const excluirPeriodo = async (id) => {
    try {
      await ds.removerPeriodoAvaliacao(id)
      setPeriodoExcluirId(null)
      if (periodoId === id) setPeriodoId('')
      await carregarDados()
    } catch (e) {
      console.warn('[PeerEvaluation] excluir período:', e?.message || e)
      setErroGeral('Não foi possível excluir o período. Tente novamente.')
    }
  }

  // ------------------------------ RENDER ------------------------------
  const tituloPeriodo = periodo
    ? `${periodo.nome} — ${rotuloEstadoPeriodo(periodo.estado)}`
    : 'Nenhum período'

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Avaliação por Pares</h4>
          <small className="text-muted-custom">Cinco critérios, escala 1–5, médias por período e gráfico radar</small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          {ehProfessor && (
            <button
              className="btn btn-primary-theme"
              onClick={() => { setPeriodoEdit(null); setModalPeriodo(true) }}
            >
              <i className="bi bi-plus-lg me-1"></i>Novo período
            </button>
          )}
          <select
            className="form-select"
            style={{ width: 260 }}
            value={periodoId}
            onChange={(e) => { setPeriodoId(e.target.value); setFeedback(''); setErroForm('') }}
            aria-label="Período de avaliação"
          >
            {periodos.length === 0 && <option value="">Nenhum período</option>}
            {periodos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome} — {rotuloEstadoPeriodo(p.estado)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erroGeral && (
        <div className="alert alert-danger py-2">
          <i className="bi bi-exclamation-triangle me-1"></i>{erroGeral}
          <button className="btn btn-link btn-sm p-0 ms-2" onClick={carregarDados}>Tentar novamente</button>
        </div>
      )}
      {feedback && (
        <div className="alert alert-success py-2">
          <i className="bi bi-check-circle me-1"></i>{feedback}
        </div>
      )}

      <div className="alert alert-secondary py-2 small mb-4">
        <i className="bi bi-shield-check me-1"></i>{AVISO_CONFIDENCIALIDADE}
      </div>

      {carregando ? (
        <div className="card">
          <div className="card-body text-center p-5 text-muted-custom">
            <div className="spinner-border mb-2" style={{ color: 'var(--color-primary)' }}></div>
            <div>Carregando avaliações...</div>
          </div>
        </div>
      ) : periodos.length === 0 ? (
        <div className="card">
          <div className="card-body text-center p-5">
            <i className="bi bi-clipboard2-data fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
            <p className="text-muted-custom mb-0">
              {ehProfessor
                ? 'Crie um período de avaliação (ex.: Sprint 2) para começar a receber avaliações por pares.'
                : 'Não há período de avaliação disponível no momento.'}
            </p>
            {ehProfessor && (
              <button className="btn btn-primary-theme mt-3" onClick={() => { setPeriodoEdit(null); setModalPeriodo(true) }}>
                <i className="bi bi-plus-lg me-1"></i>Criar período
              </button>
            )}
          </div>
        </div>
      ) : ehProfessor ? (
        // ===================== VISÃO DO PROFESSOR =====================
        <>
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0">
                <i className="bi bi-people me-2" style={{ color: 'var(--color-primary)' }}></i>
                Participação — {tituloPeriodo}
              </h6>
              <select
                className="form-select form-select-sm"
                style={{ width: 220 }}
                value={equipeFiltro}
                onChange={(e) => setEquipeFiltro(e.target.value)}
                aria-label="Filtrar por equipe"
              >
                <option value="">Todas as equipes</option>
                {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div className="card-body">
              {pendentesParticipacao.length > 0 && (
                <div className="alert alert-warning py-2 small">
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {pendentesParticipacao.length} aluno(s) ainda têm colegas pendentes de avaliação neste período.
                  Acompanhe a adesão sem usar esses números como indicador de desempenho.
                </div>
              )}
              {painel.length === 0 ? (
                <p className="text-muted-custom small mb-0">Nenhum aluno encontrado para os filtros atuais.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Equipe</th>
                        <th className="text-center">A esperadas</th>
                        <th className="text-center">Enviadas</th>
                        <th className="text-center">Rascunhos</th>
                        <th className="text-center">Pendentes</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {painel.map(linha => (
                        <tr key={linha.aluno.id}>
                          <td>
                            <i className="bi bi-person-circle me-1" style={{ color: 'var(--color-primary)' }}></i>
                            {linha.aluno.nome}
                          </td>
                          <td className="text-muted-custom">{linha.equipeNome}</td>
                          <td className="text-center">{linha.esperadas}</td>
                          <td className="text-center fw-bold">{linha.enviadas}</td>
                          <td className="text-center">{linha.rascunhos}</td>
                          <td className={`text-center ${linha.pendentes > 0 ? 'fw-bold' : ''}`}>{linha.pendentes}</td>
                          <td>
                            {linha.esperadas === 0 ? (
                              <span className="badge badge-neutral">Sem colegas</span>
                            ) : linha.pendentes === 0 ? (
                              <span className="badge badge-done">Avaliações concluídas</span>
                            ) : linha.enviadas > 0 ? (
                              <span className="badge badge-pending">Em andamento</span>
                            ) : (
                              <span className="badge badge-pending">Não iniciada</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <h6 className="mb-0">
                    <i className="bi bi-diagram-3 me-2" style={{ color: 'var(--color-primary)' }}></i>
                    Radar individual (médias recebidas)
                  </h6>
                </div>
                <div className="card-body">
                  <select
                    className="form-select mb-3"
                    value={alunoResultadosId || ''}
                    onChange={(e) => setAlunoResultadosId(e.target.value)}
                    aria-label="Selecionar aluno"
                  >
                    {alunosVisiveis.length === 0 && <option value="">Nenhum aluno</option>}
                    {alunosVisiveis.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>

                  {!linhaAlunoResultados ? (
                    <div className="text-center text-muted-custom py-4">
                      <i className="bi bi-emoji-smile fs-1 d-block mb-2"></i>
                      <span>{MSG_SEM_DADOS}</span>
                    </div>
                  ) : (
                    <>
                      <PeerRadarChart
                        medias={mediasAluno}
                        titulo={`Médias recebidas por ${linhaAlunoResultados.avaliado_nome}`}
                      />
                      <div className="text-muted-custom small text-center mt-2">
                        <i className="bi bi-people me-1"></i>
                        {linhaAlunoResultados.total_avaliacoes} avaliação(ões) válida(s) recebida(s) neste período
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <h6 className="mb-0">
                    <i className="bi bi-table me-2" style={{ color: 'var(--color-primary)' }}></i>
                    Médias por critério
                  </h6>
                </div>
                <div className="card-body p-0">
                  {!mediasAluno ? (
                    <p className="text-muted-custom small p-3 mb-0">{MSG_SEM_DADOS}</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Cr</th>
                            <th>Média</th>
                            <th>Respostas</th>
                            <th>Escala</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CRITERIOS.map(c => {
                            const m = mediasAluno[c.chave]
                            return (
                              <tr key={c.chave}>
                                <td>
                                  <strong className="small">{c.nome}</strong>
                                  <div className="text-muted-custom" style={{ fontSize: '0.75rem' }}>{c.descricao}</div>
                                </td>
                                <td className="fw-bold">{formatarMedia(m.media)}</td>
                                <td>{m.qtd || 0}</td>
                                <td style={{ minWidth: 120 }}>
                                  <div className="progress" style={{ height: 8 }}>
                                    <div
                                      className="progress-bar"
                                      style={{ width: `${m.media ? (m.media / 5) * 100 : 0}%`, backgroundColor: 'var(--color-primary)' }}
                                    ></div>
                                  </div>
                                  <small className="text-muted-custom">1 a 5</small>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <h6 className="mb-0">
                    <i className="bi bi-chat-left-text me-2" style={{ color: 'var(--color-primary)' }}></i>
                    Comentários recebidos
                  </h6>
                </div>
                <div className="card-body" style={{ maxHeight: 320, overflow: 'auto' }}>
                  {!comentariosAluno.length ? (
                    <p className="text-muted-custom small mb-0">Nenhum comentário registrado neste período.</p>
                  ) : comentariosAluno.map(a => {
                    const avaliador = usuarios.find(u => u.id === a.avaliador_id)
                    return (
                      <div key={a.id} className="p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <strong className="small">{avaliador?.nome || 'Aluno'}</strong>
                          <span className={`badge ${badgeEstadoColega(a.estado)}`}>{rotuloEstadoColega(a.estado)}</span>
                        </div>
                        <div className="small">{a.comentario?.trim() || <span className="text-muted-custom">Sem comentário</span>}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <h6 className="mb-0">
                    <i className="bi bi-diagram-2 me-2" style={{ color: 'var(--color-primary)' }}></i>
                    Visão agregada da equipe
                  </h6>
                </div>
                <div className="card-body">
                  {!equipeFiltro ? (
                    <p className="text-muted-custom small mb-0">
                      Selecione uma equipe no filtro acima para ver a média agregada do grupo no período.
                    </p>
                  ) : !mediasEquipe ? (
                    <p className="text-muted-custom small mb-0">{MSG_SEM_DADOS}</p>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {CRITERIOS.map(c => (
                        <li key={c.chave} className="d-flex justify-content-between align-items-center py-1 small" style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <span>{c.nome}</span>
                          <span className="fw-bold">{formatarMedia(mediasEquipe[c.chave].media)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Gestão de períodos */}
          <div className="card mt-4">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0">
                <i className="bi bi-calendar3 me-2" style={{ color: 'var(--color-primary)' }}></i>
                Períodos de avaliação
              </h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Início</th>
                      <th>Fim</th>
                      <th>Estado</th>
                      <th className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodos.map(p => (
                      <tr key={p.id}>
                        <td>{p.nome}</td>
                        <td>{formatarData(p.data_inicio)}</td>
                        <td>{formatarData(p.data_final)}</td>
                        <td><span className={`badge ${badgeEstadoPeriodo(p.estado)}`}>{rotuloEstadoPeriodo(p.estado)}</span></td>
                        <td className="text-end">
                          {periodoExcluirId === p.id ? (
                            <span className="d-inline-flex gap-2 align-items-center">
                              <small className="text-muted-custom">Excluir e as avaliações dele?</small>
                              <button className="btn btn-danger btn-sm" onClick={() => excluirPeriodo(p.id)}>
                                <i className="bi bi-trash"></i> Confirmar
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setPeriodoExcluirId(null)}>Não</button>
                            </span>
                          ) : (
                            <>
                              <button
                                className="btn btn-outline-secondary btn-sm me-2"
                                title="Editar período"
                                onClick={() => { setPeriodoEdit(p); setModalPeriodo(true) }}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                title="Excluir período"
                                onClick={() => setPeriodoExcluirId(p.id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        // ===================== VISÃO DO ALUNO =====================
        <>
          {!periodo ? null : periodo.estado === 'rascunho' ? (
            <div className="alert alert-warning py-2">
              <i className="bi bi-clock me-1"></i>Este período ainda não foi aberto para avaliação.
            </div>
          ) : !periodoAberto(periodo) && (
            <div className="alert alert-secondary py-2">
              <i className="bi bi-lock me-1"></i>O período foi encerrado e não aceita alterações. Consulte seus resultados abaixo.
            </div>
          )}

          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <h6 className="mb-0">
                    <i className="bi bi-people me-2" style={{ color: 'var(--color-primary)' }}></i>
                    Colegas do meu grupo
                  </h6>
                  <span className="badge rounded-pill" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
                    {progresso.concluidos} de {progresso.total} colegas avaliados
                  </span>
                </div>
                <div className="card-body">
                  {minhasEquipes.length === 0 ? (
                    <p className="text-muted-custom small mb-0">Você ainda não foi alocado em nenhuma equipe.</p>
                  ) : colegas.length === 0 ? (
                    <p className="text-muted-custom small mb-0">Você não tem colegas para avaliar no momento.</p>
                  ) : (
                    <>
                      <div className="text-muted-custom small mb-3">
                        <i className="bi bi-info-circle me-1"></i>
                        {progresso.pendentes > 0
                          ? `Você ainda precisa avaliar ${progresso.pendentes} colega(s).`
                          : 'Você avaliou todos os colegas deste período.'}
                        {progresso.rascunhos > 0 ? ` ${progresso.rascunhos} rascunho(s) aguardando envio.` : ''}
                      </div>
                      {colegas.map(colega => {
                        const estado = avaliacaoDoPar(avaliacoes, periodoId, usuarioLogado?.id, colega.id)?.estado || null
                        const selecionado = colega.id === colegaSelecionadoId
                        return (
                          <div
                            key={colega.id}
                            className="d-flex align-items-center justify-content-between p-2 rounded mb-2"
                            style={{
                              backgroundColor: selecionado ? 'var(--bg-card-hover)' : 'var(--bg-input)',
                              border: `1px solid ${selecionado ? 'var(--color-primary)' : 'var(--border-color)'}`
                            }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{ width: 36, height: 36, backgroundColor: colega.equipeCor || 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', overflow: 'hidden' }}
                              >
                                {colega.avatar_url
                                  ? <img src={colega.avatar_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} />
                                  : iniciais(colega.nome)}
                              </div>
                              <div>
                                <div className="small fw-semibold">{colega.nome}</div>
                                <small className="text-muted-custom">{colega.equipeNome}</small>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className={`badge ${badgeEstadoColega(estado)}`}>{rotuloEstadoColega(estado)}</span>
                              <button
                                className={`btn btn-sm ${selecionado ? 'btn-primary-theme' : 'btn-outline-secondary'}`}
                                disabled={!periodoAberto(periodo)}
                                onClick={() => selecionado ? setColegaSelecionadoId(null) : abrirFormulario(colega.id)}
                                title={periodoAberto(periodo) ? undefined : 'Período encerrado'}
                              >
                                {estado ? 'Editar' : 'Avaliar'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <h6 className="mb-0">
                    <i className="bi bi-clipboard-check me-2" style={{ color: 'var(--color-primary)' }}></i>
                    {colegaSelecionado ? `Avaliar ${colegaSelecionado.nome}` : 'Formulário de avaliação'}
                  </h6>
                </div>
                <div className="card-body">
                  {!colegaSelecionado ? (
                    <div className="text-center text-muted-custom py-4">
                      <i className="bi bi-people fs-1 d-block mb-2"></i>
                      <span className="small">
                        Escolha um colega na lista ao lado para avaliar os cinco critérios do período.
                      </span>
                    </div>
                  ) : !periodoAberto(periodo) ? (
                    <div className="alert alert-secondary py-2 small mb-0">
                      O período foi encerrado e não aceita alterações.
                    </div>
                  ) : (
                    <PeerEvaluationForm
                      colega={colegaSelecionado}
                      periodo={periodo}
                      avaliacao={avaliacaoDoPar(avaliacoes, periodoId, usuarioLogado?.id, colegaSelecionado.id)}
                      salvando={salvando}
                      erro={erroForm}
                      onSalvar={salvarAvaliacao}
                      onCancelar={() => { setColegaSelecionadoId(null); setErroForm('') }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0">
                <i className="bi bi-diagram-3 me-2" style={{ color: 'var(--color-primary)' }}></i>
                Meu radar de recebimento — {tituloPeriodo}
              </h6>
              {minhaLinhaResultados && (
                <span className="badge rounded-pill" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
                  {minhaLinhaResultados.total_avaliacoes} resposta(s) válida(s)
                </span>
              )}
            </div>
            <div className="card-body">
              <div className="row g-4 align-items-center">
                <div className="col-md-5 text-center">
                  <PeerRadarChart
                    medias={mediasRecebidas || {}}
                    titulo={`Médias recebidas no período ${periodo?.nome || ''}`}
                  />
                </div>
                <div className="col-md-7">
                  {!mediasRecebidas || !temAlgumDado(mediasRecebidas) ? (
                    <div className="text-muted-custom">
                      <i className="bi bi-emoji-neutral fs-4 d-block mb-2"></i>
                      {MSG_SEM_DADOS}
                      <div className="small mt-1">
                        Quando seus colegas enviarem as avaliações dele, as médias aparecem aqui.
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Cr</th>
                            <th>Média</th>
                            <th>Respostas</th>
                            <th>Escala 1–5</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CRITERIOS.map(c => {
                            const m = mediasRecebidas[c.chave]
                            return (
                              <tr key={c.chave}>
                                <td>
                                  <strong className="small">{c.nome}</strong>
                                  <div className="text-muted-custom" style={{ fontSize: '0.75rem' }}>{c.descricao}</div>
                                </td>
                                <td className="fw-bold">{m.media != null ? formatarMedia(m.media) : 'Sem dados'}</td>
                                <td>{m.qtd || 0}</td>
                                <td style={{ minWidth: 120 }}>
                                  <div className="progress" style={{ height: 8 }}>
                                    <div
                                      className="progress-bar"
                                      style={{ width: `${m.media ? (m.media / 5) * 100 : 0}%`, backgroundColor: 'var(--color-primary)' }}
                                    ></div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <div className="text-muted-custom small mt-2">
                        <i className="bi bi-lightbulb me-1"></i>
                        Reflita sobre as observações recebidas e escolha uma melhoria concreta para o próximo período.
                        {ESCALA.length > 0 && ` Referência: 1 = ${ESCALA[0].rotulo}, 3 = ${ESCALA[2].rotulo}, 5 = ${ESCALA[4].rotulo}.`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {evolucaoPeriodos.length > 1 && (
            <div className="card">
              <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
                <h6 className="mb-0">
                  <i className="bi bi-graph-up me-2" style={{ color: 'var(--color-primary)' }}></i>
                  Evolução entre períodos
                </h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Período</th>
                        {CRITERIOS.map(c => <th key={c.chave}>{c.nome}</th>)}
                        <th className="text-center">Respostas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evolucaoPeriodos.map(({ linha, periodo: p }) => (
                        <tr key={p.id}>
                          <td>
                            {p.nome}
                            <div className="text-muted-custom" style={{ fontSize: '0.75rem' }}>{rotuloEstadoPeriodo(p.estado)}</div>
                          </td>
                          {CRITERIOS.map(c => (
                            <td key={c.chave}>{formatarMedia(linha[c.chave])}</td>
                          ))}
                          <td className="text-center">{linha.total_avaliacoes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-muted-custom small p-3">
                  <i className="bi bi-info-circle me-1"></i>
                  Compare períodos apenas quando a quantidade de respostas e a composição do grupo forem parecidas —
                  poucas respostas podem distorcer a tendência.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <PeriodoAvaliacaoModal
        show={modalPeriodo}
        onClose={() => setModalPeriodo(false)}
        periodoEdit={periodoEdit}
        onSalvo={salvarPeriodo}
      />
    </div>
  )
}
