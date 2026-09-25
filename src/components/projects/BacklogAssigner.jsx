import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import * as ds from '../../services/dataService.js'
import { isProfessor, equipesDoAluno, podeEditarTarefa } from '../../utils/permissions.js'

const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente']
const ESTIMATIVAS = ['P', 'M', 'G', '1', '2', '3', '5', '8']

export function BacklogAssigner({ show, onClose, projeto, tarefaEdit }) {
  const { equipes, usuarios, refreshAll, usuarioLogado } = useApp()
  const ehProfessor = isProfessor(usuarioLogado?.papel)
  // Aluno: só pode operar nas equipes em que participa (regra do grupo)
  const idsMinhasEquipes = useMemo(
    () => new Set(equipesDoAluno(equipes, usuarioLogado?.id).map(e => e.id)),
    [equipes, usuarioLogado?.id]
  )
  // Equipe padrão: a da tarefa ou a 1ª equipe DO PROJETO que o usuário pode usar.
  const equipePadrao = (t) => {
    if (t?.equipe_id) return t.equipe_id
    const permitidas = (projeto?.equipes_ids || []).filter(id => ehProfessor || idsMinhasEquipes.has(id))
    return permitidas[0] || ''
  }
  const equipeInicial = equipePadrao(tarefaEdit)
  // Aluno já vem como responsável da própria tarefa; professor escolhe.
  const alunoPadrao = (t, eqId) => t?.aluno_id || (ehProfessor ? '' : (idsMinhasEquipes.has(eqId) ? usuarioLogado?.id : ''))
  const alunoInicial = alunoPadrao(tarefaEdit, equipeInicial)
  const [titulo, setTitulo] = useState(tarefaEdit?.titulo || '')
  const [descricao, setDescricao] = useState(tarefaEdit?.descricao || '')
  const [prioridade, setPrioridade] = useState(tarefaEdit?.prioridade || 'media')
  const [estimativa, setEstimativa] = useState(tarefaEdit?.estimativa || '')
  const [checklists, setChecklists] = useState(tarefaEdit?.checklists || [])
  const [novoCheck, setNovoCheck] = useState('')
  const [equipeId, setEquipeId] = useState(equipeInicial)
  const [alunoId, setAlunoId] = useState(alunoInicial)
  const [prazo, setPrazo] = useState(tarefaEdit?.prazo_limite ? tarefaEdit.prazo_limite.slice(0, 10) : '')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!show) return
    setTitulo(tarefaEdit?.titulo || '')
    setDescricao(tarefaEdit?.descricao || '')
    setPrioridade(tarefaEdit?.prioridade || 'media')
    setEstimativa(tarefaEdit?.estimativa || '')
    setChecklists(tarefaEdit?.checklists ? tarefaEdit.checklists.map(c => ({ ...c })) : [])
    setNovoCheck('')
    setEquipeId(equipePadrao(tarefaEdit))
    setAlunoId(alunoPadrao(tarefaEdit, equipePadrao(tarefaEdit)))
    setPrazo(tarefaEdit?.prazo_limite ? tarefaEdit.prazo_limite.slice(0, 10) : '')
    setErro('')
  }, [show, tarefaEdit, projeto])

  // Equipes do projeto; aluno vê apenas as suas e é travado nelas.
  const equipesProjeto = useMemo(() => {
    const doProjeto = equipes.filter(e => projeto?.equipes_ids?.includes(e.id))
    return ehProfessor ? doProjeto : doProjeto.filter(e => idsMinhasEquipes.has(e.id))
  }, [equipes, projeto, ehProfessor, idsMinhasEquipes])
  const membrosEquipe = equipeId
    ? equipes.find(e => e.id === equipeId)?.membros?.map(m => usuarios.find(u => u.id === m.aluno_id)).filter(Boolean)
    : []

  const salvar = async () => {
    setErro('')
    if (!titulo.trim()) { setErro('Informe o título da tarefa.'); return }
    if (!equipeId) { setErro('Selecione a equipe.'); return }
    // Guarda de segurança: aluno só cria/edita tarefas da própria equipe.
    if (!ehProfessor && !idsMinhasEquipes.has(equipeId)) {
      setErro('Aluno só pode gerenciar tarefas das equipes em que participa.')
      return
    }
    if (tarefaEdit?.id && !podeEditarTarefa(usuarioLogado, tarefaEdit, equipes)) {
      setErro('Você não tem permissão para editar esta tarefa.')
      return
    }

    const dados = {
      projeto_id: projeto.id,
      equipe_id: equipeId,
      aluno_id: alunoId || null,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      prioridade,
      estimativa: estimativa,
      checklists: checklists.filter(c => c.item.trim()),
      status: tarefaEdit?.status || 'a_fazer',
      aguardando_validacao: tarefaEdit?.aguardando_validacao || false,
      prazo_limite: prazo ? new Date(prazo + 'T23:59:59Z').toISOString() : null
    }

    if (tarefaEdit?.id) {
      await ds.atualizarTarefa(tarefaEdit.id, dados)
    } else {
      await ds.criarTarefa(dados)
    }
    await refreshAll()
    onClose()
  }

  const adicionarCheck = () => {
    if (!novoCheck.trim()) return
    setChecklists(prev => [...prev, { id: 'chk_' + Date.now(), item: novoCheck.trim(), concluido: false }])
    setNovoCheck('')
  }

  if (!show) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{tarefaEdit?.id ? 'Editar Tarefa' : 'Nova Tarefa'} — {projeto?.nome}</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {erro && <div className="alert alert-danger py-2">{erro}</div>}
            {!ehProfessor && (
              <div className="alert alert-info py-2 small">
                <i className="bi bi-info-circle me-1"></i>
                A conclusão de tarefas é validada pelo professor/gestor: ao concluir no Kanban sua tarefa fica "em análise" até o professor inserir a flag.
              </div>
            )}

            <div className="mb-3">
              <label className="form-label text-muted-custom">Título <span className="text-muted-custom small">(comece com verbo de ação)</span></label>
              <input className="form-control" placeholder="Ex: Criar formulário de check-in" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label text-muted-custom">Descrição</label>
              <textarea className="form-control" rows="2" value={descricao} onChange={(e) => setDescricao(e.target.value)}></textarea>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <label className="form-label text-muted-custom">Prioridade</label>
                <select className="form-select" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label text-muted-custom">Estimativa / Complexidade</label>
                <select className="form-select" value={estimativa} onChange={(e) => setEstimativa(e.target.value)}>
                  <option value="">— selecione —</option>
                  {ESTIMATIVAS.map(es => <option key={es} value={es}>{es}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label text-muted-custom">Data limite</label>
                <input type="date" className="form-control" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label text-muted-custom">Checklist de Critérios de Aceite</label>
              <div className="d-flex gap-2 mb-2">
                <input className="form-control form-control-sm" placeholder="Ex: Validar limite de 280 caracteres..." value={novoCheck} onChange={(e) => setNovoCheck(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarCheck()} />
                <button className="btn btn-secondary-theme btn-sm" onClick={adicionarCheck}><i className="bi bi-plus-lg"></i></button>
              </div>
              {checklists.length === 0 ? (
                <div className="text-muted-custom small">Nenhum critério de aceite adicionado.</div>
              ) : checklists.map((c, i) => (
                <div key={c.id || i} className="d-flex align-items-center gap-2 p-2 rounded mb-1" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <input type="checkbox" checked={!!c.concluido} onChange={() => setChecklists(prev => prev.map((x, xi) => xi === i ? { ...x, concluido: !x.concluido } : x))} />
                  <span className={`flex-grow-1 small ${c.concluido ? 'text-decoration-line-through text-muted-custom' : ''}`}>{c.item}</span>
                  <button className="btn btn-sm text-danger" onClick={() => setChecklists(prev => prev.filter((x, xi) => xi !== i))}><i className="bi bi-x-lg"></i></button>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="form-label text-muted-custom">
                Equipe responsável
                {!ehProfessor && <span className="badge badge-info ms-2">Somente suas equipes</span>}
              </label>
              <select
                className="form-select"
                value={equipeId}
                onChange={(e) => { setEquipeId(e.target.value); setAlunoId(alunoPadrao(null, e.target.value)) }}
                disabled={!ehProfessor && equipesProjeto.length <= 1}
              >
                <option value="">— selecione —</option>
                {equipesProjeto.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
              {!ehProfessor && (
                <small className="text-muted-custom">
                  <i className="bi bi-people me-1"></i>Aluno só pode criar/editar tarefas das equipes em que participa.
                </small>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label text-muted-custom">Aluno responsável</label>
              <select className="form-select" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} disabled={!equipeId}>
                <option value="">— sem responsável —</option>
                {membrosEquipe?.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary-theme" onClick={salvar}>Salvar Tarefa</button>
          </div>
        </div>
      </div>
    </div>
  )
}