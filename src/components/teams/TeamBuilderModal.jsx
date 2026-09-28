import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import * as ds from '../../services/dataService.js'
import { dicaUpload, validarArquivo } from '../../services/imageService.js'

const PAPEIS = ['Líder', 'Desenvolvedor', 'Frontend', 'Backend', 'Full Stack', 'UI/UX Designer', 'QA', 'Analista']

export function TeamBuilderModal({ show, onClose, equipeEdit, restrito = false }) {
  const { turmas, usuarios, equipes, setEquipes, refreshAll, usuarioLogado } = useApp()
  const [nome, setNome] = useState(equipeEdit?.nome || '')
  const [corHex, setCorHex] = useState(equipeEdit?.cor_hex || '#1686b9')
  const [logoUrl, setLogoUrl] = useState(equipeEdit?.logo_url || '')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [removerLogo, setRemoverLogo] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [githubUrl, setGithubUrl] = useState(equipeEdit?.github_url || '')
  const [filtroTurma, setFiltroTurma] = useState('all')
  const [membros, setMembros] = useState(
    equipeEdit?.membros ? equipeEdit.membros.map(m => ({ ...m })) : []
  )
  const [erro, setErro] = useState('')

  const limparSelecaoLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(null)
    setLogoPreview('')
    setRemoverLogo(false)
  }

  useEffect(() => {
    if (!show) return
    setNome(equipeEdit?.nome || '')
    setCorHex(equipeEdit?.cor_hex || '#1686b9')
    setLogoUrl(equipeEdit?.logo_url || '')
    limparSelecaoLogo()
    setGithubUrl(equipeEdit?.github_url || '')
    setMembros(equipeEdit?.membros ? equipeEdit.membros.map(m => ({ ...m })) : [])
    setFiltroTurma('all')
    setErro('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, equipeEdit])

  const selecionarLogo = (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    try {
      validarArquivo(arquivo, 'logo')
    } catch (err) {
      setErro(err?.message || 'Não foi possível usar esta imagem.')
      return
    }
    setErro('')
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoPreview(URL.createObjectURL(arquivo))
    setLogoFile(arquivo)
    setRemoverLogo(false)
  }

  const removerLogoAgora = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(null)
    setLogoPreview('')
    setRemoverLogo(true)
  }

  const alunos = usuarios.filter(u => u.papel === 'aluno')
  const alunosFiltrados = filtroTurma === 'all' ? alunos : alunos.filter(a => a.turma_id === filtroTurma)
  const idsSelecionados = membros.map(m => m.aluno_id)

  const toggleAluno = (alunoId) => {
    setMembros(prev => {
      if (idsSelecionados.includes(alunoId)) return prev.filter(m => m.aluno_id !== alunoId)
      const aluno = usuarios.find(u => u.id === alunoId)
      return [...prev, { aluno_id: alunoId, nome: aluno?.nome, papel_no_grupo: 'Desenvolvedor' }]
    })
  }

  const setPapel = (alunoId, papel) => {
    setMembros(prev => prev.map(m => m.aluno_id === alunoId ? { ...m, papel_no_grupo: papel } : m))
  }

  const salvar = async () => {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome da equipe.'); return }
    if (membros.length === 0) { setErro('Selecione pelo menos um membro.'); return }

    // Logo: sobe a nova (WebP 1:1, 1 MB, nome UUID) antes de salvar a equipe.
    let logoFinal
    if (logoFile) {
      setEnviandoLogo(true)
      try {
        const url = await ds.enviarImagem({
          bucket: 'logos',
          pasta: equipeEdit?.id || usuarioLogado?.id,
          arquivo: logoFile,
          tipo: 'logo'
        })
        if (logoUrl && logoUrl.includes('/logos/')) await ds.removerImagem('logos', logoUrl)
        logoFinal = url
      } catch (e) {
        setErro(e?.message || 'Não foi possível enviar a logo. Tente novamente.')
        setEnviandoLogo(false)
        return
      }
      setEnviandoLogo(false)
    } else if (removerLogo) {
      logoFinal = null
      if (logoUrl && logoUrl.includes('/logos/')) await ds.removerImagem('logos', logoUrl)
    } else {
      logoFinal = logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(nome.trim())}`
    }

    const dados = {
      nome: nome.trim(),
      cor_hex: corHex,
      logo_url: logoFinal,
      github_url: githubUrl.trim(),
      membros
    }

    try {
      if (equipeEdit?.id) {
        await ds.atualizarEquipe(equipeEdit.id, dados)
      } else {
        await ds.criarEquipe(dados)
      }
    } catch (e) {
      setErro(e?.message || 'Erro ao salvar a equipe. Tente novamente.')
      return
    }
    limparSelecaoLogo()
    await refreshAll()
    onClose()
  }

  if (!show) return null

  const campoLogo = (
    <div className="mb-3">
      <label className="form-label text-muted-custom">Logo da equipe</label>
      <div className="d-flex align-items-start gap-3">
        <div
          className="d-flex align-items-center justify-content-center overflow-hidden"
          style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: corHex, border: '1px solid var(--border-color)', flexShrink: 0 }}
        >
          {(removerLogo ? null : (logoPreview || logoUrl))
            ? <img src={logoPreview || logoUrl} alt="Prévia da logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <i className="bi bi-people-fill text-white fs-5"></i>}
        </div>
        <div className="flex-grow-1">
          <div className="d-flex gap-2 flex-wrap mb-1">
            <label className="btn btn-outline-primary btn-sm mb-0" style={{ cursor: 'pointer' }}>
              <i className="bi bi-upload me-1"></i>{(logoPreview || logoUrl) && !removerLogo ? 'Trocar logo' : 'Escolher imagem'}
              <input type="file" accept="image/*" className="d-none" onChange={selecionarLogo} disabled={enviandoLogo} />
            </label>
            {(logoPreview || logoUrl) && !removerLogo && (
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={removerLogoAgora} disabled={enviandoLogo}>
                <i className="bi bi-trash me-1"></i>Remover
              </button>
            )}
            {removerLogo && (
              <span className="badge badge-pending rounded-pill align-self-center">Logo será removida ao salvar</span>
            )}
          </div>
          <small className="text-muted-custom d-block">{dicaUpload('logo')}</small>
          {enviandoLogo && <small className="text-muted-custom d-block mt-1"><i className="bi bi-arrow-repeat me-1"></i>Otimizando e enviando...</small>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{restrito ? 'Editar Logo e Repositório' : (equipeEdit?.id ? 'Editar Equipe' : 'Nova Equipe')}</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {erro && <div className="alert alert-danger py-2">{erro}</div>}

            {restrito ? (
              <>
                <div className="alert alert-info py-2 small">
                  <i className="bi bi-info-circle me-1"></i>Você pode editar apenas o repositório GitHub e a logo da sua equipe.
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted-custom">Repositório GitHub (URL)</label>
                  <input className="form-control" placeholder="https://github.com/..." value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
                </div>
                {campoLogo}
              </>
            ) : (
            <>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label text-muted-custom">Nome da equipe</label>
                <input className="form-control" placeholder="Ex: Alpha Tech" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label text-muted-custom">Cor temática</label>
                <input type="color" className="form-control form-control-color" value={corHex} onChange={(e) => setCorHex(e.target.value)} />
              </div>
            </div>

            {campoLogo}

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label text-muted-custom">Repositório GitHub (URL)</label>
                <input className="form-control" placeholder="https://github.com/..." value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <h6 className="mb-0">Seleção de Membros (Mix Multi-Turma)</h6>
              <select className="form-select form-select-sm" style={{ width: 200 }} value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)}>
                <option value="all">Todas as turmas</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <div className="border rounded p-2" style={{ borderColor: 'var(--border-color)', maxHeight: 240, overflow: 'auto' }}>
                  <small className="text-muted-custom d-block mb-2"><i className="bi bi-people-fill me-1"></i>Alunos disponíveis ({alunosFiltrados.length})</small>
                  {alunosFiltrados.map(a => {
                    const turma = turmas.find(t => t.id === a.turma_id)
                    const selected = idsSelecionados.includes(a.id)
                    return (
                      <div
                        key={a.id}
                        className={`d-flex align-items-center gap-2 p-2 rounded mb-1 ${selected ? '' : ''}`}
                        style={{ cursor: 'pointer', backgroundColor: selected ? 'var(--bg-card-hover)' : 'transparent', border: '1px solid', borderColor: selected ? 'var(--color-primary)' : 'transparent' }}
                        onClick={() => toggleAluno(a.id)}
                      >
                        <input type="checkbox" readOnly checked={selected} />
                        <i className="bi bi-person-circle" style={{ color: 'var(--color-primary)' }}></i>
                        <span className="flex-grow-1 small">{a.nome}</span>
                        <span className="badge" style={{ backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>{turma?.nome || '—'}</span>
                      </div>
                    )
                  })}
                  {alunosFiltrados.length === 0 && <div className="text-muted-custom small p-2">Nenhum aluno nesta turma.</div>}
                </div>
              </div>

              <div className="col-md-6">
                <div className="border rounded p-2" style={{ borderColor: 'var(--border-color)', maxHeight: 240, overflow: 'auto' }}>
                  <small className="text-muted-custom d-block mb-2"><i className="bi bi-people me-1"></i>Equipe ({membros.length})</small>
                  {membros.length === 0 ? (
                    <div className="text-muted-custom small p-2">Selecione alunos ao lado para formar a equipe.</div>
                  ) : membros.map(m => (
                    <div key={m.aluno_id} className="d-flex align-items-center gap-2 p-2 rounded mb-1" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid', borderColor: 'var(--border-color)' }}>
                      <i className="bi bi-person-fill" style={{ color: 'var(--color-primary)' }}></i>
                      <span className="small flex-grow-1">{m.nome || 'Aluno'}</span>
                      <select className="form-select form-select-sm" style={{ width: 140 }} value={m.papel_no_grupo} onChange={(e) => setPapel(m.aluno_id, e.target.value)}>
                        {PAPEIS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button className="btn btn-sm text-danger" onClick={() => toggleAluno(m.aluno_id)}><i className="bi bi-x-lg"></i></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { limparSelecaoLogo(); onClose() }} disabled={enviandoLogo}>Cancelar</button>
            <button className="btn btn-primary-theme" onClick={salvar} disabled={enviandoLogo}>
              {enviandoLogo ? 'Enviando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}