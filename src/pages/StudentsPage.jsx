import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import * as ds from '../services/dataService.js'
import { Modal } from '../components/common/Modal.jsx'
import { ExcelUploader } from '../components/teams/ExcelUploader.jsx'
import { Badge } from '../components/common/Badge.jsx'

export default function StudentsPage() {
  const { turmas, setTurmas, usuarios, setUsuarios, refreshAll, usuarioLogado } = useApp()
  const [showTurma, setShowTurma] = useState(false)
  const [editTurma, setEditTurma] = useState(null)
  const [turmaForm, setTurmaForm] = useState({ nome: '', codigo_acesso: '', cor_hex: '#1686b9' })
  const [showImport, setShowImport] = useState(false)
  const [turmaImportId, setTurmaImportId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [confirmRemover, setConfirmRemover] = useState(null)
  const [excluirAlunos, setExcluirAlunos] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [erroRemocao, setErroRemocao] = useState(null)

  const ehProfessor = usuarioLogado?.papel === 'professor' || usuarioLogado?.papel === 'gestor'
  const alunos = usuarios.filter(u => u.papel === 'aluno')

  const abrirNovaTurma = () => {
    setEditTurma(null)
    setTurmaForm({ nome: '', codigo_acesso: '', cor_hex: '#1686b9' })
    setShowTurma(true)
  }

  const abrirEditarTurma = (turma) => {
    setEditTurma(turma)
    setTurmaForm({
      nome: turma.nome || '',
      codigo_acesso: turma.codigo_acesso || '',
      cor_hex: turma.cor_hex || '#1686b9'
    })
    setShowTurma(true)
  }

  const salvarTurma = async () => {
    if (!turmaForm.nome.trim()) { setFeedback('Informe o nome da turma.'); return }
    const dados = {
      nome: turmaForm.nome.trim(),
      codigo_acesso: turmaForm.codigo_acesso.trim() || turmaForm.nome.trim(),
      cor_hex: turmaForm.cor_hex
    }
    if (editTurma?.id) {
      const atualizada = await ds.atualizarTurma(editTurma.id, dados)
      setTurmas(prev => prev.map(t => (t.id === editTurma.id ? { ...t, ...dados, ...(atualizada || {}) } : t)))
      setFeedback('Turma atualizada com sucesso!')
    } else {
      const nova = await ds.criarTurma(dados)
      setTurmas(prev => [...prev, nova || dados])
      setFeedback('Turma criada com sucesso!')
    }
    setTurmaForm({ nome: '', codigo_acesso: '', cor_hex: '#1686b9' })
    setEditTurma(null)
    setShowTurma(false)
    await refreshAll()
  }

  const handleImportados = (qtd) => {
    setShowImport(false)
    setTurmaImportId('')
    setFeedback(`${qtd} aluno(s) importado(s) com sucesso! Senha padrão: Mudar123`)
    refreshAll()
  }

  const abrirImportacao = (turmaId) => {
    setTurmaImportId(turmaId)
    setShowImport(true)
  }

  // Exclusão com barra de progresso: cada aluno removido atualiza a barra
  // (exclusão da turma é N requisições sequenciais) e, ao final, a tela
  // exibe a mensagem de sucesso — sem deixar o usuário numa tela parada.
  const removerTurma = async () => {
    const turma = confirmRemover
    if (!turma?.id || progresso) return

    const alunosDaTurma = usuarios.filter(u => u.turma_id === turma.id && u.papel === 'aluno')
    const excluirAgora = excluirAlunos

    setErroRemocao(null)
    setProgresso({ etapa: 'preparando', atual: 0, total: alunosDaTurma.length })

    try {
      await ds.removerTurma(turma.id, { excluirAlunos: excluirAgora, onProgresso: setProgresso })
      if (excluirAgora) {
        const ids = alunosDaTurma.map(a => a.id)
        setUsuarios(prev => prev.filter(u => !ids.includes(u.id)))
      }
      setTurmas(prev => prev.filter(t => t.id !== turma.id))
      setFeedback(excluirAgora
        ? `Turma "${turma.nome}" excluída com sucesso! ${alunosDaTurma.length} aluno(s) (e todas as suas ligações) também foram removidos.`
        : `Turma "${turma.nome}" excluída com sucesso! ${alunosDaTurma.length} aluno(s) permanecem "Sem turma" e podem ser realocados.`)
      // mantém o 100% / "Concluído!" visíveis antes de fechar o modal
      await new Promise(resolve => setTimeout(resolve, 450))
    } catch (err) {
      console.error('[StudentsPage] falha ao excluir turma:', err)
        setErroRemocao('Não foi possível excluir a turma. Tente novamente.')
    } finally {
      setProgresso(null)
      setConfirmRemover(null)
      setExcluirAlunos(false)
      await refreshAll()
    }
  }

  // Percentual e texto exibidos na barra conforme a etapa recebida do serviço
  const progressoInfo = progresso ? (() => {
    const { etapa, atual = 0, total = 0 } = progresso
    if (etapa === 'alunos') {
      const pct = total > 0 ? 10 + Math.round((atual / total) * 80) : 10
      return {
        pct,
        texto: atual > 0
          ? `Removendo aluno(s) e ligações: ${atual} de ${total}...`
          : `Localizando ${total} aluno(s) para excluir...`
      }
    }
    if (etapa === 'turma') return { pct: 95, texto: 'Excluindo a turma e os vínculos restantes...' }
    if (etapa === 'concluido') return { pct: 100, texto: 'Concluído!' }
    return { pct: 5, texto: 'Preparando a exclusão...' }
  })() : null

  const alunosDaTurmaConfirm = confirmRemover
    ? usuarios.filter(u => u.turma_id === confirmRemover.id && u.papel === 'aluno')
    : []

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Turmas & Alunos</h4>
          <small className="text-muted-custom">Cadastro de turmas e importação de alunos via Excel/CSV</small>
        </div>
        {ehProfessor && (
          <button className="btn btn-primary-theme" onClick={abrirNovaTurma}>
            <i className="bi bi-plus-lg me-1"></i>Nova Turma
          </button>
        )}
      </div>

      {erroRemocao && (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-exclamation-triangle me-2"></i>{erroRemocao}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={() => setErroRemocao(null)}>Fechar</button>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check-circle-fill me-2"></i>{feedback}</span>
          <button className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      <div className="row g-3 mb-4">
        {turmas.map(turma => {
          const qtd = usuarios.filter(u => u.turma_id === turma.id && u.papel === 'aluno').length
          return (
            <div className="col-md-4 col-lg-3" key={turma.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, backgroundColor: turma.cor_hex || 'var(--color-primary)', color: '#fff' }}>
                        <i className="bi bi-people-fill"></i>
                      </span>
                      <div>
                        <h6 className="mb-0">{turma.nome}</h6>
                        <small className="text-muted-custom">{turma.codigo_acesso}</small>
                      </div>
                    </div>
                    {ehProfessor && (
                      <div className="d-flex gap-1">
                        <button
                          className="theme-toggle"
                          title="Editar turma"
                          onClick={() => abrirEditarTurma(turma)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="theme-toggle text-danger"
                          title="Excluir turma"
                          disabled={!!progresso}
                          style={progresso ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          onClick={() => { setExcluirAlunos(false); setErroRemocao(null); setConfirmRemover(turma) }}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 mb-3 text-muted-custom">
                    <i className="bi bi-person-fill me-1"></i>{qtd} aluno(s)
                  </p>
                  {ehProfessor && (
                    <button className="btn btn-outline-primary btn-sm w-100" onClick={() => abrirImportacao(turma.id)}>
                      <i className="bi bi-file-earmark-excel me-1"></i>Importar Alunos
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ backgroundColor: 'var(--bg-card)' }}>
          <h6 className="mb-0">Alunos Cadastrados ({alunos.length})</h6>
          <input className="form-control form-control-sm" style={{ width: 200 }} placeholder="Buscar aluno..." />
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>E-mail</th>
                <th>Turma</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {alunos.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted-custom py-4">Nenhum aluno cadastrado. Crie uma turma e importe sua planilha.</td></tr>
              ) : alunos.map(aluno => {
                const turma = turmas.find(t => t.id === aluno.turma_id)
                return (
                  <tr key={aluno.id}>
                    <td><i className="bi bi-person-circle me-2" style={{ color: 'var(--color-primary)' }}></i>{aluno.nome}</td>
                    <td className="text-muted-custom">{aluno.email}</td>
                    <td><Badge tipo="aluno">{turma?.nome || 'Sem turma'}</Badge></td>
                    <td>
                      {aluno.primeiro_acesso
                        ? <Badge tipo="pendente">Primeiro acesso</Badge>
                        : <Badge tipo="concluido">Ativo</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar Turma */}
      <Modal
        show={showTurma}
        key={editTurma?.id || 'nova-turma'}
        onClose={() => { setShowTurma(false); setEditTurma(null) }}
        title={editTurma?.id ? 'Editar Turma' : 'Nova Turma'}
      >
        <div className="mb-3">
          <label className="form-label text-muted-custom">Nome da turma</label>
          <input className="form-control" placeholder="Ex: 1C - Informática" value={turmaForm.nome} onChange={(e) => setTurmaForm({ ...turmaForm, nome: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label text-muted-custom">Código de acesso</label>
          <input className="form-control" placeholder="Ex: INF1C" value={turmaForm.codigo_acesso} onChange={(e) => setTurmaForm({ ...turmaForm, codigo_acesso: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label text-muted-custom">Cor temática</label>
          <input type="color" className="form-control form-control-color" value={turmaForm.cor_hex} onChange={(e) => setTurmaForm({ ...turmaForm, cor_hex: e.target.value })} />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-secondary" onClick={() => { setShowTurma(false); setEditTurma(null) }}>Cancelar</button>
          <button className="btn btn-primary-theme" onClick={salvarTurma}>Salvar</button>
        </div>
      </Modal>

      {/* Modal Importação */}
      <Modal show={showImport} onClose={() => setShowImport(false)} title="Importar Alunos" size="lg">
        <ExcelUploader turmaId={turmaImportId} onImportados={handleImportados} onCancel={() => setShowImport(false)} />
      </Modal>

      {/* Confirmar exclusão de turma (barra de progresso durante a exclusão) */}
      {confirmRemover && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {progresso
                    ? <><i className="bi bi-arrow-repeat me-2"></i>Excluindo turma</>
                    : 'Excluir turma'}
                </h5>
              </div>
              <div className="modal-body">
                {progresso ? (
                  <>
                    <p className="mb-3">
                      Excluindo <strong>{confirmRemover.nome}</strong>
                      {excluirAlunos && alunosDaTurmaConfirm.length > 0
                        ? <> e <strong>{alunosDaTurmaConfirm.length}</strong> aluno(s)</>
                        : ''}...
                    </p>
                    <div className="progress mb-2" style={{ height: 22 }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated"
                        role="progressbar"
                        style={{ width: `${progressoInfo.pct}%` }}
                        aria-valuenow={progressoInfo.pct}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        {progressoInfo.pct}%
                      </div>
                    </div>
                    <small className="text-muted-custom d-block">{progressoInfo.texto}</small>
                    <small className="text-muted-custom d-block mt-2">
                      <i className="bi bi-hourglass-split me-1"></i>Este processo pode levar alguns instantes. Não feche a página.
                    </small>
                  </>
                ) : (
                  <>
                    <p>
                      Tem certeza que deseja excluir a turma <strong>{confirmRemover.nome}</strong>?
                      Esta ação não pode ser desfeita.
                    </p>
                    {alunosDaTurmaConfirm.length > 0 && (
                      <div className="form-check mt-3 p-3 border rounded" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="excluirAlunosTurma"
                          checked={excluirAlunos}
                          onChange={(e) => setExcluirAlunos(e.target.checked)}
                        />
                        <label className="form-check-label w-100" htmlFor="excluirAlunosTurma">
                          <strong>Também excluir os {alunosDaTurmaConfirm.length} aluno(s)</strong> desta turma
                          e todas as suas ligações (daily registers, tarefas alocadas, histórico, equipes, etc.)
                        </label>
                        <ul className="small text-muted-custom mb-0 mt-2 ps-3">
                          {alunosDaTurmaConfirm.slice(0, 5).map(a => <li key={a.id}>{a.nome}</li>)}
                          {alunosDaTurmaConfirm.length > 5 && (
                            <li>... e mais {alunosDaTurmaConfirm.length - 5} aluno(s)</li>
                          )}
                        </ul>
                        {!excluirAlunos && (
                          <small className="text-muted-custom d-block mt-2">
                            Se desmarcado, apenas a turma é excluída e os alunos ficam "Sem turma" (podem ser realocados em Gerenciar Usuários).
                          </small>
                        )}
                      </div>
                    )}
                    {alunosDaTurmaConfirm.length === 0 && (
                      <small className="text-muted-custom d-block">Esta turma não possui alunos.</small>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                {progresso ? (
                  <button className="btn btn-secondary" disabled>
                    <i className="bi bi-arrow-repeat me-1"></i>Aguarde...
                  </button>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => { setConfirmRemover(null); setExcluirAlunos(false) }}>Cancelar</button>
                    <button className="btn btn-danger" onClick={removerTurma}>
                      {excluirAlunos ? 'Excluir turma e alunos' : 'Excluir turma'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}