import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { Modal } from '../components/common/Modal.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { ThOrdenavel, useOrdenacao, ordenarPor } from '../components/common/TableSort.jsx'
import { isProfessor, podeExcluirUsuario } from '../utils/permissions.js'

const PAPEIS = [
  { valor: 'gestor', label: 'Gestor' },
  { valor: 'professor', label: 'Professor' },
  { valor: 'aluno', label: 'Aluno' }
]

export default function UsersPage() {
  const { usuarios, setUsuarios, turmas, usuarioLogado, setUsuarioLogado, refreshAll } = useApp()
  const [busca, setBusca] = useState('')
  const [filtroPapel, setFiltroPapel] = useState('all')
  const [filtroTurma, setFiltroTurma] = useState('all')
  const [ordem, ordenar] = useOrdenacao('nome', 'asc')
  const [editUser, setEditUser] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', papel: 'aluno', senha: '', turma_id: '' })
  const [erro, setErro] = useState('')
  const [confirmRemover, setConfirmRemover] = useState(null)
  const [feedback, setFeedback] = useState('')
  // Contas de login (auth.users) — carregadas SOMENTE para o gestor.
  // null = RPC indisponível (migração 0007 não aplicada).
  const [contasAuth, setContasAuth] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('all')

  // Acesso à página: gestor ou professor. Só o GESTOR muda o perfil de acesso;
// o PROFESSOR apenas realoca a turma do aluno.
  const ehGestor = usuarioLogado?.papel === 'gestor'
  const podeGerenciar = isProfessor(usuarioLogado?.papel)
  const podeMudarPapel = ehGestor

  const carregarContasAuth = async () => {
    if (!ehGestor) return
    try {
      setContasAuth(await ds.listarUsuariosAuth())
    } catch (e) {
      console.warn('[UsersPage] contas auth indisponíveis:', e?.message || e)
      setContasAuth(null)
    }
  }

  useEffect(() => {
    carregarContasAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehGestor])

  const mapaAuth = useMemo(() => {
    const map = new Map()
    ;(contasAuth || []).forEach(a => map.set(a.id, a))
    return map
  }, [contasAuth])

  // GESTOR: perfis + contas que existem só no auth.users (sem perfil público).
  // Professor: permanece exatamente a lista de perfis de sempre.
  const baseUsuarios = useMemo(() => {
    const perfis = usuarios.map(u => {
      const conta = mapaAuth.get(u.id)
      return {
        ...u,
        tem_perfil: true,
        email_confirmado: conta ? conta.email_confirmado : (contasAuth ? null : undefined)
      }
    })
    if (!ehGestor || !Array.isArray(contasAuth)) return perfis
    const idsPerfis = new Set(usuarios.map(u => u.id))
    const semPerfil = contasAuth
      .filter(a => !idsPerfis.has(a.id))
      .map(a => ({
        id: a.id,
        nome: a.nome || null,
        email: a.email,
        papel: a.papel || null,
        turma_id: a.turma_id || null,
        tem_perfil: false,
        email_confirmado: a.email_confirmado,
        criadoEm: a.criado_em
      }))
    return [...perfis, ...semPerfil]
  }, [usuarios, mapaAuth, contasAuth, ehGestor])

  const mostrarStatus = ehGestor && Array.isArray(contasAuth) && contasAuth.length > 0

  const turmasPorId = useMemo(() => {
    const map = new Map()
    turmas.forEach(t => map.set(t.id, t))
    return map
  }, [turmas])

  const usuariosFiltrados = useMemo(() => baseUsuarios.filter(u => {
    const okBusca = !busca.trim()
      || (u.nome || '').toLowerCase().includes(busca.toLowerCase())
      || (u.email || '').toLowerCase().includes(busca.toLowerCase())
    const okPapel = filtroPapel === 'all' || u.papel === filtroPapel
    const okTurma = filtroTurma === 'all'
      || (filtroTurma === 'none' ? !u.turma_id : u.turma_id === filtroTurma)
    const okStatus = !mostrarStatus || filtroStatus === 'all'
      || (filtroStatus === 'nao_confirmado' && u.email_confirmado === false)
      || (filtroStatus === 'confirmado' && u.email_confirmado === true)
      || (filtroStatus === 'sem_perfil' && u.tem_perfil === false)
      || (filtroStatus === 'sem_auth' && u.tem_perfil === true && u.email_confirmado == null)
    return okBusca && okPapel && okTurma && okStatus
  }), [baseUsuarios, busca, filtroPapel, filtroTurma, filtroStatus, mostrarStatus])

  // Ordenação por clique no cabeçalho (seta asc/desc)
  const ordenacaoUsuarios = useMemo(() => ({
    nome: u => u.nome || u.email,
    email: u => u.email,
    papel: u => PAPEIS.find(p => p.valor === u.papel)?.label || u.papel || 'zz',
    turma: u => turmasPorId.get(u.turma_id)?.nome || null,
    status: u => u.tem_perfil === false
      ? 'A Sem perfil'
      : u.email_confirmado === false
        ? 'B E-mail não confirmado'
        : u.email_confirmado === true
          ? 'C Confirmado'
          : 'D Sem conta auth'
  }), [turmasPorId])

  const usuariosVisiveis = useMemo(
    () => ordenarPor(usuariosFiltrados, ordenacaoUsuarios, ordem.campo, ordem.direcao),
    [usuariosFiltrados, ordenacaoUsuarios, ordem]
  )

  const podeEditarAlvo = (user) => {
    // Conta só no auth.users (sem perfil público): só exclusão
    if (user?.tem_perfil === false) return false
    if (ehGestor) return true
    // Professor: só alunos (alterar turma)
    return user?.papel === 'aluno'
  }

  // REGRA: gestor exclui qualquer um; professor exclui SOMENTE alunos
  // (não pode excluir gestores nem outros professores); ninguém exclui a si.
  const podeExcluirAlvo = (user) => podeExcluirUsuario(usuarioLogado, user)

  const tituloExcluir = (user) => {
    if (user.id === usuarioLogado?.id) return 'Você não pode excluir o próprio usuário'
    if (!ehGestor && user.papel !== 'aluno') return 'Professores só podem excluir alunos'
    return 'Excluir usuário'
  }

  const abrirEditar = (user) => {
    if (!podeEditarAlvo(user)) {
      setFeedback('Apenas o gestor pode editar perfis que não sejam de aluno. Professores só alteram a turma do aluno.')
      return
    }
    setEditUser(user)
    setForm({
      nome: user.nome || '',
      email: user.email || '',
      papel: user.papel || 'aluno',
      senha: '',
      turma_id: user.turma_id || ''
    })
    setErro('')
    setShowEdit(true)
  }

  const salvarEdicao = async () => {
    setErro('')
    if (!editUser) return

    // Professor: somente turma do aluno (sem tocar em nome/e-mail/senha/perfil)
    if (!podeMudarPapel) {
      if (editUser.papel !== 'aluno') {
        setErro('Professores só podem alterar a turma de alunos. Peça ao gestor para editar este usuário.')
        return
      }
      await ds.atualizarUsuario(editUser.id, { turma_id: form.turma_id || null })
      const dados = { turma_id: form.turma_id || null }
      setUsuarios(prev => prev.map(u => (u.id === editUser.id ? { ...u, ...dados } : u)))
      setShowEdit(false)
      setEditUser(null)
      setFeedback('Turma do aluno atualizada com sucesso!')
      await refreshAll()
      return
    }

    if (!form.nome.trim()) { setErro('Informe o nome do usuário.'); return }
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setErro('Informe um e-mail válido.'); return
    }
    const emailDuplicado = usuarios.some(
      u => u.id !== editUser.id && (u.email || '').toLowerCase() === form.email.trim().toLowerCase()
    )
    if (emailDuplicado) { setErro('Já existe outro usuário com este e-mail.'); return }
    if (form.senha && form.senha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres.'); return }

    const dados = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      papel: form.papel
    }
    if (form.papel === 'aluno') {
      dados.turma_id = form.turma_id || null
    } else {
      dados.turma_id = null
    }
    if (form.senha) dados.senha = form.senha

    await ds.atualizarUsuario(editUser.id, dados)
    setUsuarios(prev => prev.map(u => (u.id === editUser.id ? { ...u, ...dados } : u)))
    if (usuarioLogado?.id === editUser.id) {
      setUsuarioLogado(prev => ({ ...prev, ...dados }))
    }
    setShowEdit(false)
    setEditUser(null)
    setFeedback('Usuário atualizado com sucesso!')
    await refreshAll()
  }

  const removerUsuario = async () => {
    const alvo = baseUsuarios.find(u => u.id === confirmRemover)
    if (alvo && alvo.id === usuarioLogado?.id) {
      setFeedback('Você não pode excluir o próprio usuário logado.')
      setConfirmRemover(null)
      return
    }
    if (alvo && !podeExcluirAlvo(alvo)) {
      setFeedback('Professores só podem excluir alunos. Peça ao gestor para excluir este usuário.')
      setConfirmRemover(null)
      return
    }
    await ds.removerUsuario(confirmRemover)
    setConfirmRemover(null)
    setFeedback('Usuário excluído com sucesso!')
    await refreshAll()
    await carregarContasAuth()
  }

  const getTurma = (id) => turmasPorId.get(id)

  if (!podeGerenciar) {
    return (
      <div className="card">
        <div className="card-body text-center p-5">
          <i className="bi bi-shield-lock fs-1 d-block mb-3" style={{ color: 'var(--color-primary)' }}></i>
          <h5>Acesso restrito</h5>
          <p className="text-muted-custom mb-0">Apenas gestores e professores podem gerenciar usuários.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Gerenciar Usuários</h4>
          <small className="text-muted-custom">
            {podeMudarPapel
              ? 'Edite perfis de acesso (gestor, professor, aluno), dados e exclua usuários — incluindo contas de e-mail nunca confirmado'
              : 'Como professor, você pode alterar apenas a turma de alunos e excluir apenas alunos — o perfil de acesso é alterado e gestores/professores são excluídos apenas pelo gestor.'}
          </small>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check-circle-fill me-2"></i>{feedback}</span>
          <button className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {ehGestor && contasAuth === null && (
        <div className="alert alert-info py-2 mb-4">
          <i className="bi bi-info-circle me-2"></i>
          Não foi possível carregar o status das contas de e-mail. A listagem abaixo mostra apenas os perfis cadastrados.
        </div>
      )}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ backgroundColor: 'var(--bg-card)' }}>
          <h6 className="mb-0">Usuários do Sistema ({usuariosVisiveis.length})</h6>
          <div className="d-flex gap-2 flex-wrap">
            <input
              className="form-control form-control-sm"
              style={{ width: 220 }}
              placeholder="Buscar por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              className="form-select form-select-sm"
              style={{ width: 170 }}
              value={filtroTurma}
              onChange={(e) => setFiltroTurma(e.target.value)}
              title="Filtrar por turma"
            >
              <option value="all">Todas as turmas</option>
              <option value="none">Sem turma</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select
              className="form-select form-select-sm"
              style={{ width: 160 }}
              value={filtroPapel}
              onChange={(e) => setFiltroPapel(e.target.value)}
              title="Filtrar por perfil de acesso"
            >
              <option value="all">Todos os perfis</option>
              {PAPEIS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
            {mostrarStatus && (
              <select
                className="form-select form-select-sm"
                style={{ width: 190 }}
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                title="Filtrar por status da conta"
              >
                <option value="all">Todos os status</option>
                <option value="nao_confirmado">E-mail não confirmado</option>
                <option value="confirmado">E-mail confirmado</option>
                <option value="sem_perfil">Sem perfil público</option>
                <option value="sem_auth">Sem conta de login</option>
              </select>
            )}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <ThOrdenavel campo="nome" rotulo="Usuário" ordem={ordem} onOrdenar={ordenar} />
                <ThOrdenavel campo="email" rotulo="E-mail" ordem={ordem} onOrdenar={ordenar} />
                <ThOrdenavel campo="papel" rotulo="Perfil de Acesso" ordem={ordem} onOrdenar={ordenar} />
                <ThOrdenavel campo="turma" rotulo="Turma" ordem={ordem} onOrdenar={ordenar} />
                {mostrarStatus && (
                  <ThOrdenavel campo="status" rotulo="Status da Conta" ordem={ordem} onOrdenar={ordenar} />
                )}
                <th style={{ width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosVisiveis.length === 0 ? (
                <tr><td colSpan={mostrarStatus ? 6 : 5} className="text-center text-muted-custom py-4">Nenhum usuário encontrado.</td></tr>
              ) : usuariosVisiveis.map(user => {
                const turma = getTurma(user.turma_id)
                const podeExcluir = podeExcluirAlvo(user)
                return (
                  <tr key={user.id}>
                    <td>
                      <i className="bi bi-person-circle me-2" style={{ color: 'var(--color-primary)' }}></i>
                      {user.nome || (mostrarStatus && user.tem_perfil === false ? 'Conta sem cadastro' : '')}
                      {user.id === usuarioLogado?.id && <span className="badge badge-neutral ms-2 rounded-pill">você</span>}
                    </td>
                    <td className="text-muted-custom">{user.email}</td>
                    <td>
                      {user.papel
                        ? <Badge tipo={user.papel}>{PAPEIS.find(p => p.valor === user.papel)?.label || user.papel}</Badge>
                        : <span className="badge badge-neutral rounded-pill">—</span>}
                    </td>
                    <td className="text-muted-custom">{turma?.nome || '—'}</td>
                    {mostrarStatus && (
                      <td>
                        {user.tem_perfil === false && (
                          <span className="badge badge-danger rounded-pill" title="Conta criada no login sem perfil no sistema — pode ser excluída">
                            <i className="bi bi-person-x me-1"></i>Sem perfil
                          </span>
                        )}
                        {user.email_confirmado === false && (
                          <span className="badge badge-pending rounded-pill" title="E-mail nunca confirmado">
                            <i className="bi bi-envelope-exclamation me-1"></i>E-mail não confirmado
                          </span>
                        )}
                        {user.email_confirmado === true && user.tem_perfil !== false && (
                          <span className="badge badge-done rounded-pill"><i className="bi bi-check-circle me-1"></i>Confirmado</span>
                        )}
                        {user.tem_perfil === true && user.email_confirmado == null && (
                          <span className="badge badge-neutral rounded-pill" title="Perfil criado sem conta de login correspondente">
                            <i className="bi bi-person-lock me-1"></i>Sem conta de login
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          className="theme-toggle"
                          title={user.tem_perfil === false
                            ? 'Conta sem perfil no sistema — use a exclusão'
                            : (podeEditarAlvo(user) ? 'Editar usuário' : 'Somente o gestor pode editar este usuário')}
                          disabled={!podeEditarAlvo(user)}
                          style={!podeEditarAlvo(user) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          onClick={() => podeEditarAlvo(user) && abrirEditar(user)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="theme-toggle text-danger"
                          title={tituloExcluir(user)}
                          disabled={!podeExcluir}
                          style={!podeExcluir ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          onClick={() => podeExcluir && setConfirmRemover(user.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Usuário */}
      <Modal
        show={showEdit}
        key={editUser?.id || 'edit-user'}
        onClose={() => { setShowEdit(false); setEditUser(null) }}
        title="Editar Usuário"
      >
        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        {!podeMudarPapel && (
          <div className="alert alert-info py-2">
            <i className="bi bi-info-circle me-1"></i>
            Como professor, você pode alterar <strong>apenas a turma</strong> do aluno.
            O perfil de acesso é alterado somente pelo gestor.
          </div>
        )}

        {podeMudarPapel && (
          <>
            <div className="mb-3">
              <label className="form-label text-muted-custom">Nome completo</label>
              <input className="form-control" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label text-muted-custom">E-mail</label>
              <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label text-muted-custom">Perfil de acesso</label>
              <select className="form-select" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })}>
                {PAPEIS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </select>
              <small className="text-muted-custom d-block mt-1">Somente o gestor pode alterar o perfil de acesso.</small>
            </div>
          </>
        )}

        {(form.papel === 'aluno' || (!podeMudarPapel && editUser?.papel === 'aluno')) && (
          <div className="mb-3">
            <label className="form-label text-muted-custom">Turma</label>
            <select className="form-select" value={form.turma_id} onChange={(e) => setForm({ ...form, turma_id: e.target.value })}>
              <option value="">— Sem turma —</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <small className="text-muted-custom d-block mt-1">Mova o aluno (inclusive órfão de turma excluída) para outra turma.</small>
          </div>
        )}

        {podeMudarPapel && (
          <div className="mb-2">
            <label className="form-label text-muted-custom">Nova senha <span className="small">(opcional — em branco mantém a atual)</span></label>
            <input type="password" className="form-control" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
        )}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button className="btn btn-secondary" onClick={() => { setShowEdit(false); setEditUser(null) }}>Cancelar</button>
          <button className="btn btn-primary-theme" onClick={salvarEdicao}>Salvar</button>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      {confirmRemover && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Excluir usuário</h5></div>
              <div className="modal-body">
                Tem certeza que deseja excluir <strong>{(baseUsuarios.find(u => u.id === confirmRemover)?.nome) || baseUsuarios.find(u => u.id === confirmRemover)?.email}</strong>?
                Esta ação não pode ser desfeita.
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmRemover(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={removerUsuario}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
