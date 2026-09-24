import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { calcularScoreEngajamento } from '../utils/engagementRadar.js'
import { RadarGauge } from '../components/dashboard/RadarGauge.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { Badge } from '../components/common/Badge.jsx'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_LABEL = {
  backlog: 'Backlog',
  a_fazer: 'A Fazer',
  fazendo: 'Em Andamento',
  revisao: 'Em Revisão',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado'
}

export default function StudentProfilePage() {
  const { usuarioLogado, setUsuarioLogado, usuarios, setUsuarios, tarefas, setTarefas, equipes, projetos, historico, dailyRegisters, loading, refreshAll } = useApp()

  const [showEdit, setShowEdit] = useState(false)
  const [nome, setNome] = useState(usuarioLogado?.nome || '')
  const [email, setEmail] = useState(usuarioLogado?.email || '')
  const [senha, setSenha] = useState(usuarioLogado?.senha || '')
  const [avatar, setAvatar] = useState(usuarioLogado?.avatar_url || '')
  const [msg, setMsg] = useState('')
  const [erroEdit, setErroEdit] = useState('')
  const [recarregando, setRecarregando] = useState(false)

  const meuId = usuarioLogado?.id
  // Todas as equipes do aluno (não só a primeira) — evita esconder
  // projetos vinculados a outra equipe do mesmo aluno.
  const minhasEquipes = equipes.filter(e =>
    (e.membros || []).some(m => m.aluno_id === meuId)
  )
  const minhaEquipe = minhasEquipes[0] || null
  const idsMinhasEquipes = new Set(minhasEquipes.map(e => e.id))
  // Projetos da equipe(s) OU projetos onde o aluno já tem tarefas
  // (blindagem se o vínculo equipes_ids ainda não estiver no estado).
  const meusProjetos = projetos.filter(p =>
    (p.equipes_ids || []).some(id => idsMinhasEquipes.has(id)) ||
    tarefas.some(t => t.aluno_id === meuId && t.projeto_id === p.id)
  )

  // Um único refresh extra ao montar (evita loop se o aluno não tem equipe).
  const [refreshTentado, setRefreshTentado] = useState(false)
  useEffect(() => {
    if (refreshTentado || loading) return
    if (usuarios.length === 0 && projetos.length === 0 && equipes.length === 0) {
      setRefreshTentado(true)
      refreshAll()
    }
  }, [refreshTentado, loading, usuarios.length, projetos.length, equipes.length, refreshAll])

  const minhasTarefas = tarefas.filter(t => t.aluno_id === meuId)
  const eng = calcularScoreEngajamento(meuId, tarefas, historico)

  const agora = new Date()
  const atrasadas = minhasTarefas.filter(t => t.status !== 'concluido' && new Date(t.prazo_limite) < agora)
  const impedidas = minhasTarefas.filter(t => t.status === 'bloqueado' || t.is_impedida === true)
  const checkinHoje = dailyRegisters.some(d => d.aluno_id === meuId && d.data_checkin === hojeISO())
  const projetosPertoPrazo = meusProjetos.filter(p => {
    if (!p.data_entrega) return false
    const dias = (new Date(p.data_entrega) - agora) / (1000 * 60 * 60 * 24)
    return dias >= 0 && dias <= 15
  })

  const backlogDisponivel = minhaEquipe
    ? tarefas.filter(t =>
        t.equipe_id === minhaEquipe.id &&
        t.status === 'backlog' &&
        t.aluno_id !== meuId
      )
    : []

  const getProjeto = (id) => projetos.find(p => p.id === id)

  const assumirTarefa = async (t) => {
    await ds.atualizarTarefa(t.id, { aluno_id: meuId, status: 'a_fazer' })
    await ds.registrarAtividade({ usuario_id: meuId, tarefa_id: t.id, tipo_acao: 'assumiu_tarefa', descricao: `Assumiu a tarefa "${t.titulo}"` })
    setTarefas(await ds.listarTarefas())
    setMsg(`Tarefa "${t.titulo}" assumida com sucesso!`)
  }

  const abrirEdicao = () => {
    setNome(usuarioLogado?.nome || '')
    setEmail(usuarioLogado?.email || '')
    setSenha(usuarioLogado?.senha || '')
    setAvatar(usuarioLogado?.avatar_url || '')
    setErroEdit('')
    setShowEdit(true)
  }

  const salvarPerfil = async () => {
    setErroEdit('')
    if (!nome.trim()) { setErroEdit('Informe o seu nome.'); return }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setErroEdit('Informe um e-mail válido.'); return }
    if (senha && senha.length < 6) { setErroEdit('A senha deve ter pelo menos 6 caracteres.'); return }

    const existeEmail = usuarios.some(u => u.id !== meuId && u.email === email.trim())
    if (existeEmail) { setErroEdit('Este e-mail já está em uso por outro usuário.'); return }

    const dados = { nome: nome.trim(), email: email.trim(), avatar_url: avatar.trim() }
    if (senha) dados.senha = senha
    const atualizado = await ds.atualizarUsuario(meuId, dados)
    setUsuarioLogado({ ...usuarioLogado, ...atualizado })
    setUsuarios(await ds.listarUsuarios())
    setShowEdit(false)
    setMsg('Perfil atualizado com sucesso!')
  }

  const alertas = []
  if (atrasadas.length > 0) alertas.push({ tipo: 'danger', texto: `${atrasadas.length} tarefa(s) em atraso. Revise seus prazos.` })
  if (impedidas.length > 0) alertas.push({ tipo: 'warning', texto: `${impedidas.length} tarefa(s) bloqueada(s) ou impedida(s).` })
  if (projetosPertoPrazo.length > 0) alertas.push({ tipo: 'warning', texto: `${projetosPertoPrazo.length} projeto(s) com entrega próxima.` })
  if (!checkinHoje) alertas.push({ tipo: 'info', texto: 'Você ainda não fez o check-in de hoje. Faça no Daily Register.' })

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Perfil</h4>
          <small className="text-muted-custom">Suas tarefas, backlogs, alertas e radar de engajamento</small>
        </div>
        <div className="page-header-actions d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={async () => { setRecarregando(true); try { await refreshAll() } finally { setRecarregando(false) } }} disabled={recarregando || loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>
            {recarregando || loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button className="btn btn-primary-theme" onClick={abrirEdicao}>
            <i className="bi bi-pencil-square me-1"></i>Editar Perfil
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check-circle-fill me-2"></i>{msg}</span>
          <button className="btn-close" onClick={() => setMsg('')}></button>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mb-4">
          {alertas.map((a, i) => (
            <div key={i} className={`alert alert-${a.tipo} py-2 small`}>
              <i className={`bi ${a.tipo === 'danger' ? 'bi-exclamation-triangle-fill' : a.tipo === 'warning' ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill'} me-2`}></i>
              {a.texto}
            </div>
          ))}
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-person-badge me-2" style={{ color: 'var(--color-primary)' }}></i>Meu Perfil</h6>
            </div>
            <div className="card-body text-center">
              <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 overflow-hidden" style={{ width: 96, height: 96, backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '1.6rem' }}>
                {usuarioLogado?.avatar_url
                  ? <img src={usuarioLogado.avatar_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (usuarioLogado?.nome || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <h5 className="mb-1">{usuarioLogado?.nome}</h5>
              <small className="text-muted-custom d-block mb-2">{usuarioLogado?.email}</small>
              <div className="d-flex justify-content-center gap-2 flex-wrap mb-3">
                <Badge tipo="aluno">{usuarioLogado?.papel || 'aluno'}</Badge>
                <Badge tipo="aluno">{minhaEquipe?.nome || 'Sem equipe'}</Badge>
              </div>
              {minhaEquipe && (
                <p className="small text-muted-custom mb-0">
                  <i className="bi bi-people-fill me-1"></i>Papel na equipe:{' '}
                  {(minhaEquipe.membros || []).find(m => m.aluno_id === meuId)?.papel_no_grupo || 'Integrante'}
                </p>
              )}
              <button className="btn btn-outline-primary btn-sm mt-3 w-100" onClick={abrirEdicao}>
                <i className="bi bi-pencil-square me-1"></i>Editar foto e dados
              </button>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-radar me-2" style={{ color: 'var(--color-primary)' }}></i>Radar de Engajamento</h6>
            </div>
            <div className="card-body d-flex flex-column align-items-center">
              <RadarGauge score={eng.score} corHex={eng.corHex} situacao={eng.situacao} />
              <div className="row w-100 g-2 mt-3">
                <div className="col-4 text-center"><div className="fw-bold">{eng.metricas.concluidas}</div><small className="text-muted-custom">Concluídas</small></div>
                <div className="col-4 text-center"><div className="fw-bold">{eng.metricas.dailyCheckins}</div><small className="text-muted-custom">Check-ins</small></div>
                <div className="col-4 text-center"><div className={`fw-bold ${eng.metricas.atrasadas > 0 ? 'text-danger' : ''}`}>{eng.metricas.atrasadas}</div><small className="text-muted-custom">Atrasadas</small></div>
              </div>
              <div className="row w-100 g-2 mt-2">
                <div className="col-4 text-center"><div className="fw-bold">{eng.metricas.checklists}</div><small className="text-muted-custom">Checklists</small></div>
                <div className="col-4 text-center"><div className="fw-bold">{eng.metricas.comentarios}</div><small className="text-muted-custom">Comentários</small></div>
                <div className="col-4 text-center"><div className={`fw-bold ${eng.metricas.impedidas > 0 ? 'text-warning' : ''}`}>{eng.metricas.impedidas}</div><small className="text-muted-custom">Impedidas</small></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-clipboard-data me-2" style={{ color: 'var(--color-primary)' }}></i>Meus Projetos</h6>
            </div>
            <div className="card-body" style={{ maxHeight: 320, overflow: 'auto' }}>
              {meusProjetos.length === 0 ? (
                <div className="small text-muted-custom">
                  <p className="mb-2">Você ainda não está vinculado a nenhum projeto.</p>
                  {minhaEquipe ? (
                    <div className="p-2 rounded" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                      <div className="mb-1"><b>Equipe:</b> {minhaEquipe.nome}</div>
                      <div className="mb-1"><b>Papel:</b> {(minhaEquipe.membros || []).find(m => m.aluno_id === meuId)?.papel_no_grupo || 'Integrante'}</div>
                      <div className="mb-1"><b>Projetos carregados:</b> {projetos.length}</div>
                      <div className="mb-0">Peça ao professor para vincular esta equipe ao projeto em <b>Projetos</b>, ou toque em <b>Atualizar</b>.</div>
                    </div>
                  ) : (
                    <div className="p-2 rounded" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                      <div className="mb-1"><b>Equipe:</b> nenhuma alocada</div>
                      <div className="mb-0">Fale com seu professor para entrar em uma equipe. Enquanto isso, toque em <b>Atualizar</b>.</div>
                    </div>
                  )}
                </div>
              ) : meusProjetos.map(p => (
                <div key={p.id} className="p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                  <div className="fw-bold small">{p.nome}</div>
                  <div className="small text-muted-custom mb-1">{p.descricao}</div>
                  <div className="small"><span className="text-muted-custom">Entrega: </span>{p.data_entrega ? new Date(p.data_entrega).toLocaleDateString() : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-0">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-list-task me-2" style={{ color: 'var(--color-primary)' }}></i>Minhas Tarefas ({minhasTarefas.length})</h6>
            </div>
            <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
              {minhasTarefas.length === 0 ? (
                <p className="text-muted-custom small mb-0">Nenhuma tarefa atribuída a você. Assuma tarefas no backlog abaixo.</p>
              ) : minhasTarefas.map(t => (
                <div key={t.id} className="p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className={`small fw-bold ${t.status === 'concluido' ? 'text-decoration-line-through text-muted-custom' : ''}`}>{t.titulo}</div>
                      <small className="text-muted-custom">{getProjeto(t.projeto_id)?.nome || 'Projeto'}</small>
                    </div>
                    <Badge tipo={t.status}>{STATUS_LABEL[t.status] || t.status}</Badge>
                  </div>
                  {t.is_impedida && <div className="small text-warning mt-1"><i className="bi bi-exclamation-octagon-fill me-1"></i>Impedida</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h6 className="mb-0"><i className="bi bi-inboxes me-2" style={{ color: 'var(--color-primary)' }}></i>Backlog Disponível ({backlogDisponivel.length})</h6>
            </div>
            <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
              {backlogDisponivel.length === 0 ? (
                <p className="text-muted-custom small mb-0">Nenhuma tarefa de backlog disponível na sua equipe. Fale com seu professor.</p>
              ) : backlogDisponivel.map(t => (
                <div key={t.id} className="p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="small fw-bold">{t.titulo}</div>
                      <small className="text-muted-custom d-block">{t.descricao}</small>
                      <small className="text-muted-custom">{getProjeto(t.projeto_id)?.nome || ''}</small>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <Badge tipo={t.prioridade}>{t.prioridade}</Badge>
                    <button className="btn btn-success btn-sm" onClick={() => assumirTarefa(t)}>
                      <i className="bi bi-plus-circle me-1"></i>Assumir Tarefa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal show={showEdit} onClose={() => setShowEdit(false)} title="Editar Meu Perfil">
        {erroEdit && <div className="alert alert-danger py-2">{erroEdit}</div>}
        <div className="mb-3">
          <label className="form-label text-muted-custom">Nome</label>
          <input className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label text-muted-custom">E-mail</label>
          <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label text-muted-custom">Senha de acesso</label>
          <input type="password" className="form-control" placeholder="Deixe em branco para manter a atual" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label text-muted-custom">Foto (URL)</label>
          <input className="form-control" placeholder="https://..." value={avatar} onChange={(e) => setAvatar(e.target.value)} />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancelar</button>
          <button className="btn btn-primary-theme" onClick={salvarPerfil}>Salvar</button>
        </div>
      </Modal>
    </div>
  )
}