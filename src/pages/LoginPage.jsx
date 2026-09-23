import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { isSupabaseDisponivel, entrarModoConectado } from '../services/supabaseClient.js'

export default function LoginPage({ onLoginSuccess }) {
  const { setUsuarioLogado } = useApp()
  // vista: login | cadastro (demo e teste de conexão removidos da UI)
  const [vista, setVista] = useState('login')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState('aluno')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const finalizarLogin = async (usuario) => {
    if (onLoginSuccess) await onLoginSuccess()
    setUsuarioLogado(usuario)
  }

  const irPara = (v) => {
    setVista(v)
    setErro('')
    setSucesso('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErro('')
    setSucesso('')
    if (!isSupabaseDisponivel()) {
      setErro('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente.')
      return
    }
    setCarregando(true)
    try {
      entrarModoConectado()
      const usuario = await ds.autenticarSupabase(email.trim(), senha)
      await finalizarLogin(usuario)
    } catch (err) {
      setErro(err.message || 'Erro ao entrar')
    } finally {
      setCarregando(false)
    }
  }

  const handleCadastro = async (e) => {
    e.preventDefault()
    setErro('')
    setSucesso('')
    if (!nome.trim() || !email.trim() || !senha) {
      setErro('Preencha nome, e-mail e senha.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (!isSupabaseDisponivel()) {
      setErro('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente.')
      return
    }
    setCarregando(true)
    try {
      entrarModoConectado()
      const resultado = await ds.cadastrarUsuarioPublico({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        papel,
        funcao_principal: papel === 'aluno' ? 'Integrante' : papel === 'professor' ? 'Professor' : 'Gestor',
        primeiro_acesso: true
      })
      setSucesso(resultado.mensagem || 'Usuário cadastrado com sucesso! Faça login com seu e-mail e senha.')
      setNome('')
      setEmail('')
      setSenha('')
      setConfirmar('')
      setPapel('aluno')
      setVista('login')
    } catch (err) {
      setErro(err.message || 'Erro ao cadastrar usuário')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="text-center mb-4">
          <i className="bi bi-mortarboard-fill fs-1 login-brand d-block mb-2"></i>
          <h3 className="fw-bold mb-1">EduProject Agile</h3>
          <p className="text-muted-custom mb-0">Gestão Ágil Educacional</p>
        </div>

        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        {sucesso && <div className="alert alert-success py-2">{sucesso}</div>}

        {vista === 'login' && (
          <>
            <h6 className="text-muted-custom text-center mb-3">Entrar no sistema</h6>
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label text-muted-custom">E-mail</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                    <i className="bi bi-envelope"></i>
                  </span>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label text-muted-custom">Senha</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary-theme w-100 mt-1" disabled={carregando || !isSupabaseDisponivel()}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            <div className="text-center mt-3">
              <button
                type="button"
                className="btn btn-link p-0"
                style={{ color: 'var(--color-secondary)' }}
                onClick={() => irPara('cadastro')}
              >
                Cadastrar novo usuário
              </button>
            </div>
          </>
        )}

        {vista === 'cadastro' && (
          <>
            <h6 className="text-muted-custom text-center mb-3">Cadastrar novo usuário</h6>
            <form onSubmit={handleCadastro}>
              <div className="mb-2">
                <label className="form-label text-muted-custom">Nome completo</label>
                <input type="text" className="form-control" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="mb-2">
                <label className="form-label text-muted-custom">E-mail</label>
                <input type="email" className="form-control" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mb-2">
                <label className="form-label text-muted-custom">Papel</label>
                <select className="form-select" value={papel} onChange={(e) => setPapel(e.target.value)}>
                  <option value="aluno">Aluno</option>
                  <option value="professor">Professor</option>
                  <option value="gestor">Gestor</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label text-muted-custom">Senha</label>
                <input type="password" className="form-control" placeholder="Mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label text-muted-custom">Confirmar senha</label>
                <input type="password" className="form-control" placeholder="Repita a senha" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary-theme w-100" disabled={carregando || !isSupabaseDisponivel()}>
                {carregando ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </form>
            <div className="text-center mt-3">
              <button
                type="button"
                className="btn btn-link p-0"
                style={{ color: 'var(--color-secondary)' }}
                onClick={() => irPara('login')}
              >
                <i className="bi bi-arrow-left me-1"></i>Voltar ao login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
