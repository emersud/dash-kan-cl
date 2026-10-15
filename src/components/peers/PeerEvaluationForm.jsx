import React, { useState, useEffect } from 'react'
import {
  CRITERIOS,
  ESCALA,
  ORIENTACAO_FORMULARIO,
  rotuloNota,
  validarEnvio,
  validarRascunho
} from '../../utils/peerEvaluation.js'

function iniciais(nome = '') {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * Formulário de avaliação de um colega: 5 critérios (escala 1–5),
 * comentário opcional, salvar rascunho e envio com confirmação.
 */
export function PeerEvaluationForm({ colega, periodo, avaliacao, salvando, erro, onSalvar, onCancelar }) {
  const [notas, setNotas] = useState({})
  const [comentario, setComentario] = useState('')
  const [erroLocal, setErroLocal] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    const proximo = {}
    for (const criterio of CRITERIOS) proximo[criterio.chave] = avaliacao?.[criterio.chave] ?? null
    setNotas(proximo)
    setComentario(avaliacao?.comentario || '')
    setErroLocal('')
    setConfirmando(false)
  }, [avaliacao, colega?.id])

  const setNota = (chave, nota) => {
    setNotas(anterior => ({ ...anterior, [chave]: nota }))
    setErroLocal('')
  }

  const salvarRascunho = () => {
    const erroValidacao = validarRascunho(notas)
    if (erroValidacao) { setErroLocal(erroValidacao); return }
    onSalvar({ notas, comentario, enviar: false })
  }

  const pedirEnvio = () => {
    const erroValidacao = validarEnvio(notas)
    if (erroValidacao) { setErroLocal(erroValidacao); return }
    setErroLocal('')
    setConfirmando(true)
  }

  const confirmarEnvio = () => {
    if (validarEnvio(notas)) return
    onSalvar({ notas, comentario, enviar: true })
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 44, height: 44, backgroundColor: 'var(--color-primary)', color: '#fff', fontWeight: 'bold' }}
        >
          {colega?.avatar_url
            ? <img src={colega.avatar_url} alt="" className="rounded-circle" style={{ width: 44, height: 44, objectFit: 'cover' }} />
            : iniciais(colega?.nome || '')}
        </div>
        <div>
          <strong>{colega?.nome}</strong>
          <div className="text-muted-custom small">
            Período: {periodo?.nome}
            {periodo?.data_inicio || periodo?.data_final
              ? ` (${periodo?.data_inicio || '...'} a ${periodo?.data_final || '...'})`
              : ''}
          </div>
        </div>
      </div>

      <div className="alert alert-secondary py-2 small mb-3">
        <i className="bi bi-info-circle me-1"></i>{ORIENTACAO_FORMULARIO}
      </div>

      {(erroLocal || erro) && (
        <div className="alert alert-danger py-2 small">
          <i className="bi bi-exclamation-triangle me-1"></i>{erroLocal || erro}
        </div>
      )}

      {CRITERIOS.map(criterio => (
        <div
          key={criterio.chave}
          className="p-3 rounded mb-3"
          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
        >
          <div className="fw-semibold small mb-1">{criterio.nome}</div>
          <div className="text-muted-custom small mb-2">{criterio.pergunta}</div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {ESCALA.map(opcao => {
              const selecionada = notas[criterio.chave] === opcao.nota
              return (
                <label
                  key={opcao.nota}
                  className={`btn btn-sm d-inline-flex align-items-center justify-content-center ${selecionada ? 'btn-primary-theme' : 'btn-outline-secondary'}`}
                  style={{ minWidth: 44, minHeight: 40 }}
                  title={`${opcao.nota} — ${opcao.rotulo}`}
                >
                  <input
                    type="radio"
                    name={`nota-${criterio.chave}`}
                    className="visually-hidden"
                    checked={selecionada}
                    onChange={() => setNota(criterio.chave, opcao.nota)}
                    aria-label={`${criterio.nome}: nota ${opcao.nota} — ${opcao.rotulo}`}
                  />
                  {opcao.nota}
                </label>
              )
            })}
            <span className="small text-muted-custom ms-1">
              {notas[criterio.chave] ? rotuloNota(notas[criterio.chave]) : 'Sem nota'}
            </span>
          </div>
        </div>
      ))}

      <label className="form-label text-muted-custom small">
        Comentário construtivo (opcional)
      </label>
      <textarea
        className="form-control mb-2"
        rows={3}
        maxLength={500}
        placeholder="Ex: dividia bem as tarefas; poderia comentar mais as decisões no daily..."
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      ></textarea>
      <div className="text-muted-custom small mb-3">{comentario.length}/500 caracteres</div>

      {confirmando ? (
        <div className="p-3 rounded mb-2" style={{ border: '1px solid var(--color-primary)', backgroundColor: 'var(--bg-card-hover)' }}>
          <div className="small mb-3">
            Enviar a avaliação de <strong>{colega?.nome}</strong> no período <strong>{periodo?.nome}</strong>?
            Enviada, ela entra nas médias e permanece editável até o encerramento do período.
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={() => setConfirmando(false)} disabled={salvando}>
              <i className="bi bi-arrow-left me-1"></i>Voltar
            </button>
            <button className="btn btn-primary-theme" onClick={confirmarEnvio} disabled={salvando}>
              <i className="bi bi-send me-1"></i>Confirmar envio
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={salvarRascunho} disabled={salvando}>
            <i className="bi bi-save me-1"></i>{salvando === 'rascunho' ? 'Salvando...' : 'Salvar rascunho'}
          </button>
          <button className="btn btn-primary-theme" onClick={pedirEnvio} disabled={salvando}>
            <i className="bi bi-send me-1"></i>{salvando === 'envio' ? 'Enviando...' : 'Enviar avaliação'}
          </button>
          <button className="btn btn-link text-muted-custom" onClick={onCancelar} disabled={!!salvando}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
