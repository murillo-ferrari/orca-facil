import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../lib/format'
import type { MonthPoint } from './data'

// Paleta categórica (slots 1 e 2), validada com o validador de paleta: contraste e daltonismo OK
const SERIES = [
  { key: 'quoted', label: 'Orçado', hint: 'enviados, pela data de emissão', color: '#2a78d6' },
  { key: 'approved', label: 'Aprovado', hint: 'pela data de aprovação', color: '#eb6834' },
] as const

const HEIGHT = 240
const M = { top: 12, right: 8, bottom: 28, left: 64 }
const BAR_MAX = 24
const BAR_GAP = 2 // espaço entre as duas barras do mesmo mês

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const axisMoney = (v: number) => (v === 0 ? 'R$ 0' : `R$ ${compact.format(v)}`)

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Barra com topo arredondado (4px) e base reta na linha de base */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = Math.max(0, ...data.flatMap((d) => [d.quoted, d.approved]))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const innerW = width - M.left - M.right
  const innerH = HEIGHT - M.top - M.bottom
  const band = innerW / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(BAR_MAX, (band * 0.7 - BAR_GAP) / 2))
  const y = (v: number) => M.top + innerH - (v / top) * innerH
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 52)))
  const h = hover !== null ? data[hover] : null

  return (
    <div>
      {/* Legenda */}
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="font-medium text-slate-800">{s.label}</span>
            <span className="text-slate-400">({s.hint})</span>
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Valores orçados e aprovados por mês"
          className="block overflow-visible"
        >
          {/* Grade e eixo Y (recessivos) */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#cbd5e1' : '#eef2f6'} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#64748b">
                {axisMoney(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = M.left + band * i + band / 2
            const x0 = cx - barW - BAR_GAP / 2
            const active = hover === i
            return (
              <g key={d.month}>
                {active && <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill="#f1f5f9" />}
                {SERIES.map((s, si) => {
                  const v = d[s.key]
                  const bh = Math.max(0, y(0) - y(v))
                  return bh > 0 ? (
                    <path key={s.key} d={barPath(x0 + si * (barW + BAR_GAP), y(v), barW, bh)} fill={s.color} />
                  ) : null
                })}
                {i % labelEvery === 0 && (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                    {d.label}
                  </text>
                )}
                {/* Área de hover maior que as barras */}
                <rect
                  x={M.left + band * i}
                  y={M.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: orçado ${formatCurrency(d.quoted)}, aprovado ${formatCurrency(d.approved)}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
              </g>
            )
          })}
        </svg>

        {h && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 w-52 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(M.left + band * hover + band / 2 - 104, 0), width - 208),
              top: 0,
            }}
          >
            <p className="mb-1.5 font-semibold text-slate-900 capitalize">{h.label}</p>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 py-0.5">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {formatCurrency(h[s.key])}{' '}
                  <span className="font-normal text-slate-400">
                    ({s.key === 'quoted' ? h.quotedCount : h.approvedCount})
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
