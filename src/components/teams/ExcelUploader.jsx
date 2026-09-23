import React, { useState } from 'react'
import { lerPlanilha, gerarPlanilhaAlunos } from '../../services/excelService.js'
import * as ds from '../../services/dataService.js'

export function ExcelUploader({ turmaId, onImportados, onCancel }) {
  const [arrastando, setArrastando] = useState(false)
  const [colunas, setColunas] = useState([])
  const [mapeamento, setMapeamento] = useState({ nome: '', email: '', matricula: '' })
  const [preview, setPreview] = useState([])
  const [arquivo, setArquivo] = useState(null)
  const [erro, setErro] = useState('')
  const [importando, setImportando] = useState(false)

  const processarArquivo = async (file) => {
    setErro('')
    setPreview([])
    try {
      const rows = await lerPlanilha(file)
      if (!rows || rows.length === 0) {
        setErro('A planilha está vazia ou não pôde ser lida.')
        return
      }
      const chaves = Object.keys(rows[0])
      setColunas(chaves)
      setArquivo(file)
      setPreview(rows)
      const auto = chaves.find(c => /nome/i.test(c))
      const autoEmail = chaves.find(c => /mail/i.test(c))
      const autoMat = chaves.find(c => /matr/i.test(c))
      setMapeamento({
        nome: auto || chaves[0] || '',
        email: autoEmail || '',
        matricula: autoMat || ''
      })
    } catch (e) {
      setErro('Não foi possível ler o arquivo. Use .xlsx ou .csv.')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (file) processarArquivo(file)
  }

  const confirmarImportacao = async () => {
    setErro('')
    if (!arquivo || !mapeamento.nome) {
      setErro('Selecione a coluna que representa o Nome do aluno.')
      return
    }
    setImportando(true)
    try {
      const alunos = gerarPlanilhaAlunos(preview, mapeamento, turmaId)
      for (const a of alunos) {
        await ds.criarUsuario(a)
      }
      if (onImportados) onImportados(alunos.length)
      setPreview([])
      setColunas([])
      setArquivo(null)
      setMapeamento({ nome: '', email: '', matricula: '' })
    } catch (e) {
      setErro('Erro ao importar alunos: ' + e.message)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div>
      <div
        className="border rounded p-4 text-center mb-3"
        style={{
          borderStyle: 'dashed',
          borderColor: arrastando ? 'var(--color-primary)' : 'var(--border-color)',
          backgroundColor: arrastando ? 'var(--bg-card-hover)' : 'var(--bg-card)'
        }}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
      >
        <i className="bi bi-file-earmark-excel fs-1 d-block mb-2" style={{ color: 'var(--color-secondary)' }}></i>
        <p className="mb-1 text-muted-custom">Arraste e solte sua planilha aqui</p>
        <p className="text-muted-custom small mb-3">Formatos aceitos: .xlsx, .xls ou .csv</p>
        <div className="d-flex justify-content-center gap-2">
          <label className="btn btn-primary-theme btn-sm">
            <i className="bi bi-upload me-1"></i> Selecionar arquivo
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleChange} />
          </label>
          {onCancel && (
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>
              <i className="bi bi-x-lg me-1"></i> Cancelar
            </button>
          )}
        </div>
      </div>

      {erro && <div className="alert alert-danger py-2">{erro}</div>}

      {colunas.length > 0 && (
        <div className="border rounded p-3" style={{ borderColor: 'var(--border-color)' }}>
          <h6 className="mb-3">Mapeamento de Colunas</h6>
          <div className="row g-2">
            {[{ k: 'nome', label: 'Coluna do Nome *' }, { k: 'email', label: 'Coluna do E-mail' }, { k: 'matricula', label: 'Coluna da Matrícula' }].map(c => (
              <div className="col-md-4" key={c.k}>
                <label className="form-label small text-muted-custom">{c.label}</label>
                <select
                  className="form-select form-select-sm"
                  value={mapeamento[c.k]}
                  onChange={(e) => setMapeamento({ ...mapeamento, [c.k]: e.target.value })}
                >
                  <option value="">— selecione —</option>
                  {colunas.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <small className="text-muted-custom d-block mb-1">Prévia ({preview.length} registros)</small>
            <div className="table-responsive" style={{ maxHeight: 180 }}>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Nome</th><th>E-mail</th><th>Matrícula</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td>{r[mapeamento.nome] || ''}</td>
                      <td>{mapeamento.email ? (r[mapeamento.email] || '') : ''}</td>
                      <td>{mapeamento.matricula ? (r[mapeamento.matricula] || '') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            {onCancel && (
              <button className="btn btn-secondary btn-sm" onClick={onCancel}>
                <i className="bi bi-x-lg me-1"></i>Cancelar
              </button>
            )}
            <button className="btn btn-secondary-theme btn-sm" onClick={confirmarImportacao} disabled={importando}>
              {importando ? 'Importando...' : <><i className="bi bi-check-lg me-1"></i>Confirmar importação</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}