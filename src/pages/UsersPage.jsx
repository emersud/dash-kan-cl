import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { Modal } from '../components/common/Modal.jsx'
import { Badge } from '../components/common/Badge.jsx'
import { isProfessor } from '../utils/permissions.js'

const PAPEIS = [
  { valor: 'gestor', label: 'Gestor' },
  { valor: 'professor', label: 'Professor' },
  { valor: 'aluno', label: 'Aluno' }
]

export default function UsersPage() {
  const { usuarios, setUsuarios, turmas, usuarioLogado, setUsuarioLogado, refreshAll } = useApp()
  const [busca, setBusca] = useState('')
  const [filtroPapel, setFiltroPapel] = useState('all')
  const [editUser, setEditUser] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', papel: 'aluno', senha: '', turma_id: '' })
  const [erro, setErro] = useState('')
  const [confirmRemover, setConfirmRemover] = useState(null)
  const [feedback, setFeedback] = useState('')

  // Acesso à página: gestor ou professor. Só o GESTOR muda o perfil de acesso;
// o PROFESSOR apenas realoca a turma do aluno.
  const ehGestor = usuarioLogado?.papel === 'gestor'
  const podeGerenciar = isProfessor(usuarioLogado?.papel)
  const podeMudarPapel = ehGestor

  const usuariosFiltrados = usuarios.filter(u => {
    const okBusca = !busca.trim()
      || (u.nome || '').toLowerCase().includes(busca.toLowerCase())
      || (u.email || '').toLowerCase().includes(busca.toLowerCase())
    const okPapel = filtroPapel === 'all' || u.papel === filtroPapel
    return okBusca && okPapel
  })

  const podeEditarAlvo = (user) => {
    if (ehGestor) return true
    // Professor: só alunos (alterar turma)
    return user?.papel === 'aluno'
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
    const alvo = usuarios.find(u => u.id === confirmRemover)
    if (alvo && alvo.id === usuarioLogado?.id) {
      setFeedback('Você não pode excluir o próprio usuário logado.')
      setConfirmRemover(null)
      return
    }
    await ds.removerUsuario(confirmRemover)
    setConfirmRemover(null)
    setFeedback('Usuário excluído com sucesso!')
    await refreshAll()
  }

  const getTurma = (id) => turmas.find(t => t.id === id)

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
              ? 'Edite perfis de acesso (gestor, professor, aluno), dados e exclua usuários'
              : 'Como professor, você pode alterar apenas a turma de alunos. O perfil de acesso é alterado apenas pelo gestor.'}
          </small>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check-circle-fill me-2"></i>{feedback}</span>
          <button className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ backgroundColor: 'var(--bg-card)' }}>
          <h6 className="mb-0">Usuários do Sistema ({usuariosFiltrados.length})</h6>
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
              style={{ width: 160 }}
              value={filtroPapel}
              onChange={(e) => setFiltroPapel(e.target.value)}
            >
              <option value="all">Todos os perfis</option>
              {PAPEIS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Perfil de Acesso</th>
                <th>Turma</th>
                <th style={{ width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted-custom py-4">Nenhum usuário encontrado.</td></tr>
              ) : usuariosFiltrados.map(user => {
                const turma = getTurma(user.turma_id)
                const ehProprio = user.id === usuarioLogado?.id
                return (
                  <tr key={user.id}>
                    <td>
                      <i className="bi bi-person-circle me-2" style={{ color: 'var(--color-primary)' }}></i>
                      {user.nome}
                      {ehProprio && <span className="badge badge-neutral ms-2 rounded-pill">você</span>}
                    </td>
                    <td className="text-muted-custom">{user.email}</td>
                    <td><Badge tipo={user.papel}>{PAPEIS.find(p => p.valor === user.papel)?.label || user.papel}</Badge></td>
                    <td className="text-muted-custom">{turma?.nome || '—'}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          className="theme-toggle"
                          title={podeEditarAlvo(user) ? 'Editar usuário' : 'Somente o gestor pode editar este usuário'}
                          disabled={!podeEditarAlvo(user)}
                          style={!podeEditarAlvo(user) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          onClick={() => podeEditarAlvo(user) && abrirEditar(user)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="theme-toggle text-danger"
                          title="Excluir usuário"
                          disabled={ehProprio}
                          style={ehProprio ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          onClick={() => !ehProprio && setConfirmRemover(user.id)}
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
                Tem certeza que deseja excluir <strong>{usuarios.find(u => u.id === confirmRemover)?.nome}</strong>?
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
