import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Download, Loader2, Trash2 } from 'lucide-react'
import { useStore } from '../store/store'
import type { Quote } from '../types'
import { quoteTotals } from '../lib/calc'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import { STATUS } from '../lib/status'
import { downloadQuotePdf } from '../pdf/exportPdf'
import { Badge, Button } from './ui'
import { toast } from './toast'
import { confirmDialog } from './confirm'

/** Linha de orçamento usada nas listas (orçamentos e página do cliente) */
export function QuoteRow({
  quote: q,
  showClient = true,
  showProfile = false,
}: {
  quote: Quote
  showClient?: boolean
  showProfile?: boolean
}) {
  const navigate = useNavigate()
  const profile = useStore((s) => s.profiles.find((p) => p.id === q.profileId))
  const duplicateQuote = useStore((s) => s.duplicateQuote)
  const deleteQuote = useStore((s) => s.deleteQuote)
  const [downloading, setDownloading] = useState(false)

  const total = quoteTotals(q).total
  const expired = q.validUntil < todayISO() && (q.status === 'rascunho' || q.status === 'enviado')

  async function handleDownload() {
    if (!profile) return toast('A empresa deste orçamento foi excluída', 'error')
    setDownloading(true)
    try {
      await downloadQuotePdf(q, profile)
    } catch (e) {
      console.error(e)
      toast('Não foi possível gerar o PDF', 'error')
    } finally {
      setDownloading(false)
    }
  }

  // Sem título, identifica o orçamento pelos itens (ex.: "Pintura da sala +2 itens")
  const described = q.items.filter((it) => it.description.trim())
  const itemsSummary = described.length
    ? described[0].description +
      (described.length > 1 ? ` +${described.length - 1} ite${described.length > 2 ? 'ns' : 'm'}` : '')
    : ''
  const mainLine = showClient ? q.client.name : q.title || itemsSummary
  const secondary = showClient ? q.title : ''

  return (
    <div
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5"
      onClick={() => navigate(`/orcamentos/${q.id}`)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{q.number}</span>
          <Badge className={STATUS[q.status].className}>{STATUS[q.status].label}</Badge>
          {expired && <Badge className="bg-red-50 text-red-600">Vencido</Badge>}
        </div>
        <p className="mt-0.5 truncate font-medium text-slate-900">
          {mainLine || <span className="font-normal text-slate-400">{showClient ? 'Sem cliente' : 'Sem itens'}</span>}
          {secondary && <span className="font-normal text-slate-500"> · {secondary}</span>}
        </p>
        <p className="text-xs text-slate-500">
          {formatDate(q.issueDate)} · válido até {formatDate(q.validUntil)}
          {showProfile && profile && ` · ${profile.label || profile.tradeName}`}
        </p>
      </div>
      <p className="text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(total)}</p>
      <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" aria-label="Baixar PDF" title="Baixar PDF" onClick={handleDownload}>
          {downloading ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <Download size={16} />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Duplicar"
          title="Duplicar"
          className="hidden sm:inline-flex"
          onClick={() => {
            const id = duplicateQuote(q.id)
            if (id) {
              toast('Orçamento duplicado')
              navigate(`/orcamentos/${id}`)
            }
          }}
        >
          <Copy size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Excluir"
          title="Excluir"
          className="hidden hover:text-red-600 sm:inline-flex"
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Excluir orçamento',
              message: `Excluir o orçamento ${q.number}?`,
              confirmLabel: 'Excluir',
              danger: true,
            })
            if (ok) {
              deleteQuote(q.id)
              toast('Orçamento excluído')
            }
          }}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  )
}
