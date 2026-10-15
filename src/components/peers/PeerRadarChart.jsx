import React from 'react'
import { CRITERIOS, formatarMedia, temAlgumDado, MSG_SEM_DADOS } from '../../utils/peerEvaluation.js'

// Gráfico radar dos 5 critérios (escala 1–5) das médias recebidas.
// Alternativa textual: a página exibe também a tabela com os mesmos valores.
export function PeerRadarChart({ medias, corHex = 'var(--color-primary)', titulo }) {
  const lado = 320
  const centro = lado / 2
  const raioMax = 108
  const eixos = CRITERIOS.map((criterio, i) => ({
    criterio,
    angulo: -Math.PI / 2 + (i * 2 * Math.PI) / CRITERIOS.length
  }))

  const ponto = (angulo, raio) => ({
    x: centro + Math.cos(angulo) * raio,
    y: centro + Math.sin(angulo) * raio
  })

  const raioDoValor = (valor) => {
    if (valor == null) return 0
    const limitado = Math.min(5, Math.max(1, Number(valor)))
    return (limitado / 5) * raioMax
  }

  const anel = (nivel) =>
    eixos
      .map(e => ponto(e.angulo, (nivel / 5) * raioMax))
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ')

  const dadosExistentes = temAlgumDado(medias)
  const poligono = eixos
    .map(e => ponto(e.angulo, raioDoValor(medias?.[e.criterio.chave]?.media)))
    .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  const descricao = dadosExistentes
    ? CRITERIOS.map(c => `${c.nome}: ${formatarMedia(medias[c.chave]?.media)}`).join('; ')
    : MSG_SEM_DADOS

  return (
    <div className="d-flex flex-column align-items-center">
      <svg
        width={lado}
        height={lado}
        viewBox={`0 0 ${lado} ${lado}`}
        role="img"
        aria-label={titulo ? `${titulo}. ${descricao}` : descricao}
        style={{ width: '100%', height: 'auto', maxWidth: lado }}
      >
        {/* Anéis da escala (1 a 5) */}
        {[1, 2, 3, 4, 5].map(nivel => (
          <polygon
            key={nivel}
            points={anel(nivel)}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={nivel === 5 ? 1.5 : 1}
            opacity={nivel === 5 ? 0.9 : 0.55}
          />
        ))}
        {/* Eixos */}
        {eixos.map(e => {
          const fim = ponto(e.angulo, raioMax)
          return (
            <line
              key={e.criterio.chave}
              x1={centro}
              y1={centro}
              x2={fim.x}
              y2={fim.y}
              stroke="var(--border-color)"
              strokeWidth="1"
              opacity="0.7"
            />
          )
        })}
        {/* Polígono das médias */}
        {dadosExistentes && (
          <>
            <polygon points={poligono} fill={corHex} fillOpacity="0.28" stroke={corHex} strokeWidth="2" />
            {eixos.map(e => {
              const p = ponto(e.angulo, raioDoValor(medias[e.criterio.chave]?.media))
              return <circle key={e.criterio.chave} cx={p.x} cy={p.y} r="4" fill={corHex} />
            })}
          </>
        )}
        {/* Rótulos dos critérios */}
        {eixos.map(e => {
          const p = ponto(e.angulo, raioMax + 30)
          const valor = medias?.[e.criterio.chave]?.media
          const nome = e.criterio.nome.length > 18
            ? e.criterio.nome.split(' ')
            : [e.criterio.nome]
          const ancora =
            Math.abs(Math.cos(e.angulo)) < 0.2 ? 'middle' : Math.cos(e.angulo) > 0 ? 'start' : 'end'
          return (
            <g key={`rotulo-${e.criterio.chave}`}>
              <text
                x={p.x}
                y={nome.length > 1 ? p.y - 6 : p.y}
                textAnchor={ancora}
                fill="var(--text-secondary)"
                fontSize="12"
                fontWeight="600"
              >
                {nome.map((linha, i) => (
                  <tspan key={i} x={p.x} dy={i === 0 ? 0 : 13}>{linha}</tspan>
                ))}
              </text>
              <text
                x={p.x}
                y={nome.length > 1 ? p.y + 20 : p.y + 15}
                textAnchor={ancora}
                fill="var(--text-primary)"
                fontSize="12"
                fontWeight="bold"
              >
                {dadosExistentes ? formatarMedia(valor) : '—'}
              </text>
            </g>
          )
        })}
        {/* Marcas da escala no eixo superior */}
        {[1, 3, 5].map(nivel => {
          const p = ponto(-Math.PI / 2, (nivel / 5) * raioMax)
          return (
            <text key={`escala-${nivel}`} x={p.x + 6} y={p.y + 3} fill="var(--text-muted)" fontSize="10">
              {nivel}
            </text>
          )
        })}
      </svg>
      {!dadosExistentes && (
        <div className="text-center mt-2">
          <span className="badge badge-neutral">{MSG_SEM_DADOS}</span>
        </div>
      )}
    </div>
  )
}
