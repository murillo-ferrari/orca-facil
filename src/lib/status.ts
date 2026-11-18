import type { QuoteStatus } from '../types'

export const STATUS: Record<QuoteStatus, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700' },
  enviado: { label: 'Enviado', className: 'bg-amber-50 text-amber-700' },
  aprovado: { label: 'Aprovado', className: 'bg-emerald-50 text-emerald-700' },
  recusado: { label: 'Recusado', className: 'bg-red-50 text-red-700' },
}

export const STATUS_ORDER: QuoteStatus[] = ['rascunho', 'enviado', 'aprovado', 'recusado']
