import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MessageCircle, XCircle } from 'lucide-react'
import { useStore } from '../store/store'
import { formatCurrency, formatDate, onlyDigits } from '../lib/format'
import { Badge, Button, Segmented, cn } from '../components/ui'
import { toast } from '../components/toast'
import { followUpReport, type FollowUpRow } from './data'
import { CsvButton, Section, StatTile, type ViewProps } from './shared'

const WINDOWS = [7, 15, 30] as const

const GROUPS: { key: FollowUpRow['group']; title: string; empty: string }[] = [
  { key: 'vencido', title: 'Vencidos sem resposta', empty: 'Nenhum orçamento vencido sem resposta.' },
  { key: 'vencendo', title: 'Vencem em breve', empty: 'Nenhum orçamento vencendo nesse prazo.' },
  { key: 'aberto', title: 'Demais em aberto', empty: 'Nenhum outro orçamento aguardando resposta.' },
]

const days = (n: number) => `${n} dia${n === 1 ? '' : 's'}`

/** Link do WhatsApp com mensagem de acompanhamento já escrita */
function whatsappLink(phone: string, name: string, number: string) {
  let d = onlyDigits(phone)
  if (d.length === 10 || d.length === 11) d = `55${d}`
  if (d.length < 12) return null
  const first = name.trim().split(/\s+/)[0]
  const msg = `Olá${first ? `, ${first}` : ''}! Tudo bem? Passando para saber se você conseguiu avaliar o orçamento ${number}. Fico à disposição para qualquer dúvida.`
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`
}

export function FollowUpView({ ctx, filters }: ViewProps) {
  const navigate = useNavigate()
  const updateQuote = useStore((s) => s.updateQuote)
  const [windowDays, setWindowDays] = useState<number>(7)
  const rows = useMemo(() => followUpReport(ctx, filters, windowDays), [ctx, filters, windowDays])
  const phoneOf = (r: FollowUpRow) =>
    r.quote.client.phone || ctx.clients.find((c) => c.id === r.quote.client.clientId)?.phone || ''

  const sum = (g: FollowUpRow['group']) => {
    const rs = rows.filter((r) => r.group === g)
    return { count: rs.length, value: rs.reduce((a, r) => a + r.total, 0) }
  }
  const s = { vencido: sum('vencido'), vencendo: sum('vencendo'), aberto: sum('aberto') }

  function mark(r: FollowUpRow, status: 'aprovado' | 'recusado') {
    updateQuote(r.quote.id, { status })
    toast(`${r.quote.number} marcado como ${status}`)
  }

  const buildCsv = () => ({
    header: [
      'Situação',
      'Número',
      'Cliente',
      'Telefone',
      'Enviado em',
      'Dias desde o envio',
      'Validade',
      'Dias para vencer',
      'Valor',
    ],
    rows: rows.map((r) => [
      GROUPS.find((g) => g.key === r.group)!.title,
      r.quote.number,
      r.quote.client.name,
      phoneOf(r),
      formatDate(r.sentOn),
      r.daysSinceSent,
      formatDate(r.quote.validUntil),
      r.daysToExpire,
      r.total,
    ]),
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          Considerar “vencendo em breve” até
          <Segmented
            size="sm"
            value={String(windowDays)}
            onChange={(v) => setWindowDays(Number(v))}
            options={WINDOWS.map((w) => ({ value: String(w), label: `${w} dias` }))}
          />
        </div>
        <CsvButton filename="follow-up" build={buildCsv} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Vencidos sem resposta"
          tone={s.vencido.count ? 'bad' : 'default'}
          value={s.vencido.count}
          sub={formatCurrency(s.vencido.value)}
        />
        <StatTile
          label={`Vencem em até ${windowDays} dias`}
          tone={s.vencendo.count ? 'warn' : 'default'}
          value={s.vencendo.count}
          sub={formatCurrency(s.vencendo.value)}
        />
        <StatTile label="Demais em aberto" value={s.aberto.count} sub={formatCurrency(s.aberto.value)} />
      </div>

      <p className="text-xs text-slate-500">
        Mostra todos os orçamentos com status <strong>Enviado</strong>, independentemente do período. Marque como
        aprovado ou recusado assim que tiver a resposta.
      </p>

      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.group === g.key)
        return (
          <Section key={g.key} title={`${g.title} (${list.length})`} className="break-inside-avoid">
            {list.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">{g.empty}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((r) => {
                  const phone = phoneOf(r)
                  const wa = whatsappLink(phone, r.quote.client.name, r.quote.number)
                  return (
                    <li
                      key={r.quote.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 break-inside-avoid"
                    >
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => navigate(`/orcamentos/${r.quote.id}`)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{r.quote.number}</span>
                          <Badge
                            className={cn(
                              r.daysToExpire < 0
                                ? 'bg-red-50 text-red-600'
                                : r.daysToExpire <= windowDays
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {r.daysToExpire < 0
                              ? `venceu há ${days(-r.daysToExpire)}`
                              : r.daysToExpire === 0
                                ? 'vence hoje'
                                : `vence em ${days(r.daysToExpire)}`}
                          </Badge>
                        </div>
                        <p className="truncate font-medium text-slate-900">
                          {r.quote.client.name || <span className="text-slate-400">Sem cliente</span>}
                          {r.quote.title && <span className="font-normal text-slate-500"> · {r.quote.title}</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          Enviado em {formatDate(r.sentOn)} (
                          {r.daysSinceSent === 0 ? 'hoje' : `há ${days(r.daysSinceSent)}`}){phone && ` · ${phone}`}
                        </p>
                      </button>
                      <p className="font-semibold text-slate-900 tabular-nums">{formatCurrency(r.total)}</p>
                      <div className="flex flex-wrap gap-1.5 print:hidden">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle size={14} /> Cobrar
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-700"
                          onClick={() => mark(r, 'aprovado')}
                        >
                          <CheckCircle2 size={14} /> Aprovado
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => mark(r, 'recusado')}>
                          <XCircle size={14} /> Recusado
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
        )
      })}
    </div>
  )
}
