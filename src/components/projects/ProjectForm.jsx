import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import * as ds from '../../services/dataService.js'

export function ProjectForm({ show, onClose, projetoEdit }) {
  const { equipes, refreshAll } = useApp()
  const [nome, setNome] = useState(projetoEdit?.nome || '')
  const [descricao, setDescricao] = useState(projetoEdit?.descricao || '')
  const [dataInicio, setDataInicio] = useState(
    projetoEdit?.data_inicio ? projetoEdit.data_inicio.slice(0, 10) : ''
  )
  const [dataEntrega, setDataEntrega] = useState(
    projetoEdit?.data_entrega ? projetoEdit.data_entrega.slice(0, 10) : ''
  )
  const [recursos, setRecursos] = useState(projetoEdit?.recursos || '')
  const [equipesIds, setEquipesIds] = useState(projetoEdit?.equipes_ids || [])
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!show) return
    setNome(projetoEdit?.nome || '')
    setDescricao(projetoEdit?.descricao || '')
    setDataInicio(projetoEdit?.data_inicio ? projetoEdit.data_inicio.slice(0, 10) : '')
    setDataEntrega(projetoEdit?.data_entrega ? projetoEdit.data_entrega.slice(0, 10) : '')
    setRecursos(projetoEdit?.recursos || '')
    setEquipesIds(projetoEdit?.equipes_ids || [])
    setErro('')
  }, [show, projetoEdit])

  const todasSelecionadas = equipes.length > 0 && equipesIds.length === equipes.length

  const toggleTodasEquipes = () => {
    setEquipesIds(todasSelecionadas ? [] : equipes.map(e => e.id))
  }

  const toggleEquipe = (id) => {
    setEquipesIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const salvar = async () => {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome do projeto.'); return }
    if (!dataEntrega) { setErro('Informe a data de entrega.'); return }
    if (equipesIds.length === 0) { setErro('Vincule pelo menos uma equipe.'); return }

    const dados = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      data_inicio: dataInicio ? new Date(dataInicio + 'T12:00:00Z').toISOString() : null,
      data_entrega: new Date(dataEntrega + 'T23:59:59Z').toISOString(),
      recursos: recursos.trim(),
      equipes_ids: equipesIds
    }

    if (projetoEdit?.id) {
      await ds.atualizarProjeto(projetoEdit.id, dados)
    } else {
      await ds.criarProjeto(dados)
    }
    await refreshAll()
    onClose()
  }

  if (!show) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{projetoEdit?.id ? 'Editar Projeto' : 'Novo Projeto'}</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {erro && <div className="alert alert-danger py-2">{erro}</div>}

            <div className="mb-3">
              <label className="form-label text-muted-custom">Nome do projeto</label>
              <input className="form-control" placeholder="Ex: Plataforma de Gestão de Turmas - MVP" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label text-muted-custom">Descrição / Objetivo</label>
              <textarea className="form-control" rows="2" placeholder="Breve resumo do problema que o projeto resolve" value={descricao} onChange={(e) => setDescricao(e.target.value)}></textarea>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label text-muted-custom">Data de início</label>
                <input type="date" className="form-control" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-muted-custom">Data limite final (entrega)</label>
                <input type="date" className="form-control" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label text-muted-custom">Links recomendados / Recursos</label>
              <textarea className="form-control" rows="2" placeholder="Ex: Figma, documentação, repositório base..." value={recursos} onChange={(e) => setRecursos(e.target.value)}></textarea>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label text-muted-custom d-block mb-0">Equipes participantes (todas ou seleção individual)</label>
              {equipes.length > 0 && (
                <button
                  type="button"
                  className={`btn btn-sm ${todasSelecionadas ? 'btn-outline-primary' : 'btn-primary-theme'}`}
                  onClick={toggleTodasEquipes}
                >
                  <i className={`bi ${todasSelecionadas ? 'bi-x-lg' : 'bi-check-all'} me-1`}></i>
                  {todasSelecionadas ? 'Limpar todas' : 'Todas as equipes'}
                </button>
              )}
            </div>
            {equipes.length === 0 ? (
              <div className="text-muted-custom small mb-3">Nenhuma equipe cadastrada. Crie equipes na tela de Equipes.</div>
            ) : (
              <div className="d-flex flex-wrap gap-2 mb-2">
                {equipes.map(eq => {
                  const sel = equipesIds.includes(eq.id)
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      className="badge rounded-pill p-2"
                      style={{
                        backgroundColor: sel ? eq.cor_hex : 'var(--bg-badge)',
                        color: sel ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid',
                        borderColor: sel ? eq.cor_hex : 'var(--border-color)'
                      }}
                      onClick={() => toggleEquipe(eq.id)}
                    >
                      <i className={`bi ${sel ? 'bi-check-lg' : 'bi-plus'} me-1`}></i>{eq.nome}
                    </button>
                  )
                })}
              </div>
            )}
            {equipes.length > 0 && (
              <div className="text-muted-custom small mb-2">
                <i className="bi bi-info-circle me-1"></i>
                {equipesIds.length === 0
                  ? 'Nenhuma equipe selecionada.'
                  : `${equipesIds.length} de ${equipes.length} equipe(s) selecionada(s).`}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary-theme" onClick={salvar}>Salvar Projeto</button>
          </div>
        </div>
      </div>
    </div>
  )
}