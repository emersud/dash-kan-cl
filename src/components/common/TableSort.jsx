import React, { useCallback, useState } from 'react'

// Ordenação de tabelas com cabeçalho clicável (seta asc/desc).
// * números/datas ordenam por valor; textos com locale pt-BR (numeric: true)
// * itens sem valor (null / vazio / '—') ficam SEMPRE no final,
//   independentemente da direção da ordenação.

function normalizar(v) {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return v.getTime()
  return v
}

function compararNaoVazios(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base', numeric: true })
}

// getters: { [campo]: (item) => valorOrdenacao }
export function ordenarPor(lista, getters, campo, direcao) {
  const get = campo ? getters[campo] : null
  if (!get) return lista

  const sinal = direcao === 'desc' ? -1 : 1
  const comValor = []
  const semValor = []

  lista.forEach(item => {
    const v = normalizar(get(item))
    if (v === null) semValor.push(item)
    else comValor.push({ item, v })
  })

  comValor.sort((x, y) => sinal * compararNaoVazios(x.v, y.v))
  return [...comValor.map(x => x.item), ...semValor]
}

// [ordem, ordenar] — ordem = { campo, direcao }
export function useOrdenacao(campoPadrao = null, direcaoPadrao = 'asc') {
  const [ordem, setOrdem] = useState({ campo: campoPadrao, direcao: direcaoPadrao })

  const ordenar = useCallback((campo) => {
    setOrdem(prev => (prev.campo === campo
      ? { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' }
      : { campo, direcao: 'asc' }))
  }, [])

  return [ordem, ordenar]
}

export function ThOrdenavel({ campo, rotulo, ordem, onOrdenar, style, className }) {
  const ativo = ordem.campo === campo
  const direcao = ativo ? ordem.direcao : null
  const icone = !ativo ? 'bi-arrow-down-up' : (direcao === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down')

  return (
    <th
      className={className}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => onOrdenar(campo)}
      aria-sort={ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={ativo
        ? `Ordenado por ${rotulo} (${direcao === 'asc' ? 'crescente' : 'decrescente'}) — clique para inverter`
        : `Ordenar por ${rotulo}`}
    >
      <span className="d-inline-flex align-items-center gap-1">
        {rotulo}
        <i className={`bi ${icone}`} style={{ fontSize: '0.68rem', opacity: ativo ? 1 : 0.4 }}></i>
      </span>
    </th>
  )
}
