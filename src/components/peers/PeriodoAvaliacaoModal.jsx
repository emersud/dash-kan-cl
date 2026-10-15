import React, { useState, useEffect } from 'react'
import * as ds from '../../services/dataService.js'
import { rotuloEstadoPeriodo } from '../../utils/peerEvaluation.js'

const ESTADOS = ['rascunho', 'aberto', 'encerrado']

/**
 * Gestão de períodos de avaliação (Sprint/ciclo) — somente professor/gestor.
 * Só períodos 'aberto' aceitam avaliações; 'encerrado' fica para consulta e
 * 'rascunho' ainda não foi publicado.
 */
export function PeriodoAvaliacaoModal({ show, onClose, periodoEdit, onSalvo }) {
  const [nome, setNome] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [estado, setEstado] = useState('aberto')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!show) return
    setNome(periodoEdit?.nome || '')
    setDataInicio(periodoEdit?.data_inicio ? String(periodoEdit.data_inicio).slice(0, 10) : '')
    setDataFinal(periodoEdit?.data_final ? String(periodoEdit.data_final).slice(0, 10) : '')
    setEstado(periodoEdit?.estado || 'aberto')
    setErro('')
    setSalvando(false)
  }, [show, periodoEdit])

  const salvar = async () => {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome do período (ex.: Sprint 2).'); return }
    if (dataInicio && dataFinal && dataFinal < dataInicio) {
      setErro('A data final deve ser posterior à data inicial.')
      return
    }
    const dados = {
      nome: nome.trim(),
      data_inicio: dataInicio || null,
      data_final: dataFinal || null,
      estado
    }
    setSalvando(true)
    try {
      if (periodoEdit?.id) await ds.atualizarPeriodoAvaliacao(periodoEdit.id, dados)
      else await ds.criarPeriodoAvaliacao(dados)
      await onSalvo?.()
      onClose()
    } catch (e) {
      console.warn('[PeriodoAvaliacaoModal]', e?.message || e)
      setErro('Não foi possível salvar o período. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{periodoEdit?.id ? 'Editar Período de Avaliação' : 'Novo Período de Avaliação'}</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {erro && <div className="alert alert-danger py-2">{erro}</div>}

            <div className="mb-3">
              <label className="form-label text-muted-custom">Nome do período</label>
              <input
                className="form-control"
                placeholder="Ex: Sprint 2"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label text-muted-custom">Data inicial</label>
                <input type="date" className="form-control" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-muted-custom">Data final</label>
                <input type="date" className="form-control" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label text-muted-custom">Estado do período</label>
              <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS.map(e => (
                  <option key={e} value={e}>{rotuloEstadoPeriodo(e)}</option>
                ))}
              </select>
            </div>

            <div className="text-muted-custom small">
              <i className="bi bi-info-circle me-1"></i>
              Apenas períodos <strong>Abertos</strong> aceitam novas avaliações ou alterações.
              Períodos <strong>Encerrados</strong> ficam somente para consulta.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary-theme" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Período'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
