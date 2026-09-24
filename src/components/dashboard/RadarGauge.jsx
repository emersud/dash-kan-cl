import React from 'react'

export function RadarGauge({ score, corHex, situacao }) {
  const raio = 54
  const circunferencia = 2 * Math.PI * raio
  const offset = circunferencia - (score / 100) * circunferencia

  return (
    <div className="d-flex flex-column align-items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={raio} fill="none" stroke="var(--border-color)" strokeWidth="12" />
        <circle
          cx="65" cy="65" r={raio} fill="none"
          stroke={corHex} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circunferencia} strokeDashoffset={offset}
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="65" y="65" textAnchor="middle" dominantBaseline="central" fill="var(--text-primary)" fontSize="26" fontWeight="bold">
          {score}
        </text>
      </svg>
      <small className="text-muted-custom text-center" style={{ maxWidth: 120, fontSize: '0.7rem' }}>{situacao}</small>
    </div>
  )
}