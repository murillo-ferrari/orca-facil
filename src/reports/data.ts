import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import type { CatalogItem, Client, Quote, QuoteItem, QuoteStatus } from '../types'
import { itemTotal, quoteTotals } from '../lib/calc'
import { onlyDigits, parseDate, toISODate } from '../lib/format'

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

export type PeriodPreset = 'mes' | 'mes-anterior' | 'trimestre' | 'ano' | '12m' | 'tudo' | 'custom'

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  mes: 'Este mês',
  'mes-anterior': 'Mês passado',
  trimestre: 'Últimos 3 meses',
  ano: 'Este ano',
  '12m': 'Últimos 12 meses',
  tudo: 'Todo o período',
  custom: 'Personalizado',
}

export interface ReportFilters {
  /** '' = todas as empresas */
  profileId: string
  preset: PeriodPreset
  from: string
  to: string
  /** vazio = todos */
  statuses: QuoteStatus[]
  clientKey: string
  serviceKey: string
  minValue: number | null
  maxValue: number | null
}

export const defaultFilters = (profileId: string): ReportFilters => ({
  profileId,
  preset: '12m',
  from: '',
  to: '',
  statuses: [],
  clientKey: '',
  serviceKey: '',
  minValue: null,
  maxValue: null,
})

/** Intervalo [from, to] em yyyy-MM-dd; null = sem limite */
export function periodRange(f: Pick<ReportFilters, 'preset' | 'from' | 'to'>, today = new Date()) {
  const r = (a: Date, b: Date) => ({ from: toISODate(a), to: toISODate(b) })
  switch (f.preset) {
    case 'mes':
      return r(startOfMonth(today), endOfMonth(today))
    case 'mes-anterior': {
      const m = subMonths(today, 1)
      return r(startOfMonth(m), endOfMonth(m))
    }
    case 'trimestre':
      return r(startOfMonth(subMonths(today, 2)), endOfMonth(today))
    case 'ano':
      return r(startOfYear(today), endOfYear(today))
    case '12m':
      return r(startOfMonth(subMonths(today, 11)), endOfMonth(today))
    case 'tudo':
      return { from: null, to: null }
    case 'custom':
      return { from: f.from || null, to: f.to || null }
  }
}

export const inRange = (iso: string, range: { from: string | null; to: string | null }) =>
  !!iso && (!range.from || iso >= range.from) && (!range.to || iso <= range.to)

/* ------------------------------------------------------------------ */
/* Datas a partir do histórico de status                               */
/* ------------------------------------------------------------------ */

const localDate = (isoDateTime: string) => toISODate(new Date(isoDateTime))

/**
 * Data (yyyy-MM-dd) em que o orçamento entrou no status informado.
 * Orçamentos criados antes do histórico existir caem na data de emissão.
 */
export function statusDate(q: Quote, status: QuoteStatus): string {
  const hit = (q.statusHistory ?? []).findLast((h) => h.status === status)
  return hit ? localDate(hit.at) : q.issueDate
}

/** O histórico registra de fato esta transição (e não é uma estimativa pela emissão)? */
export const hasStatusRecord = (q: Quote, status: QuoteStatus) =>
  (q.statusHistory ?? []).some((h) => h.status === status)

/* ------------------------------------------------------------------ */
/* Chaves de agrupamento                                               */
/* ------------------------------------------------------------------ */

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Identifica o cliente de um orçamento. Mesma regra da página do cliente:
 * vínculo com o cadastro > CPF/CNPJ igual ao de um cliente cadastrado > documento > nome.
 */
export function makeClientKeyOf(clients: Client[]) {
  const byDoc = new Map<string, string>()
  for (const c of clients) {
    const d = onlyDigits(c.document)
    if (d) byDoc.set(d, c.id)
  }
  return (q: Quote): string => {
    if (q.client.clientId) return `id:${q.client.clientId}`
    const d = onlyDigits(q.client.document)
    if (d) return byDoc.has(d) ? `id:${byDoc.get(d)}` : `doc:${d}`
    const n = norm(q.client.name)
    return n ? `nome:${n}` : 'sem-cliente'
  }
}

/** Identifica o serviço de um item: vínculo com o catálogo ou descrição normalizada */
export const serviceKeyOf = (it: QuoteItem) => (it.catalogId ? `cat:${it.catalogId}` : `txt:${norm(it.description)}`)

const filledItems = (q: Quote) => q.items.filter((it) => it.description.trim())

/* ------------------------------------------------------------------ */
/* Contexto e filtragem                                                */
/* ------------------------------------------------------------------ */

export interface ReportContext {
  quotes: Quote[]
  clients: Client[]
  catalog: CatalogItem[]
  today: string
}

export interface Option {
  value: string
  label: string
}

/** Clientes e serviços que aparecem nos orçamentos (para os seletores de filtro) */
export function filterOptions(ctx: ReportContext, profileId: string) {
  const quotes = ctx.quotes.filter((q) => !profileId || q.profileId === profileId)
  const keyOf = makeClientKeyOf(ctx.clients)
  const clientNames = new Map<string, string>()
  for (const q of quotes) {
    const key = keyOf(q)
    if (key === 'sem-cliente') continue
    const registered = key.startsWith('id:') && ctx.clients.find((c) => c.id === key.slice(3))
    clientNames.set(key, registered ? registered.name : q.client.name || q.client.document)
  }
  const services = serviceNames(quotes, ctx.catalog)
  const sortByLabel = (a: Option, b: Option) => a.label.localeCompare(b.label, 'pt-BR')
  return {
    clients: [...clientNames].map(([value, label]) => ({ value, label })).sort(sortByLabel),
    services: [...services].map(([value, label]) => ({ value, label })).sort(sortByLabel),
  }
}

/** Nome de exibição de cada serviço: nome atual no catálogo ou a descrição mais usada */
function serviceNames(quotes: Quote[], catalog: CatalogItem[]) {
  const counts = new Map<string, Map<string, number>>()
  for (const q of quotes)
    for (const it of filledItems(q)) {
      const key = serviceKeyOf(it)
      const m = counts.get(key) ?? new Map<string, number>()
      m.set(it.description.trim(), (m.get(it.description.trim()) ?? 0) + 1)
      counts.set(key, m)
    }
  const names = new Map<string, string>()
  for (const [key, m] of counts) {
    const cat = key.startsWith('cat:') ? catalog.find((c) => c.id === key.slice(4)) : undefined
    names.set(key, cat?.description ?? [...m].sort((a, b) => b[1] - a[1])[0][0])
  }
  return names
}

/** Aplica os filtros que não são de data */
export function applyFilters(ctx: ReportContext, f: ReportFilters, opts: { ignoreStatus?: boolean } = {}): Quote[] {
  const keyOf = makeClientKeyOf(ctx.clients)
  return ctx.quotes.filter((q) => {
    if (f.profileId && q.profileId !== f.profileId) return false
    if (!opts.ignoreStatus && f.statuses.length && !f.statuses.includes(q.status)) return false
    if (f.clientKey && keyOf(q) !== f.clientKey) return false
    if (f.serviceKey && !filledItems(q).some((it) => serviceKeyOf(it) === f.serviceKey)) return false
    if (f.minValue !== null || f.maxValue !== null) {
      const total = quoteTotals(q).total
      if (f.minValue !== null && total < f.minValue) return false
      if (f.maxValue !== null && total > f.maxValue) return false
    }
    return true
  })
}

const sumTotals = (qs: Quote[]) => qs.reduce((acc, q) => acc + quoteTotals(q).total, 0)
const isSent = (q: Quote) => q.status !== 'rascunho'
const rate = (num: number, den: number) => (den ? num / den : null)

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

export interface MonthPoint {
  month: string // yyyy-MM
  label: string // "nov/26"
  quoted: number
  approved: number
  quotedCount: number
  approvedCount: number
}

export function overviewReport(ctx: ReportContext, f: ReportFilters) {
  const range = periodRange(f)
  const base = applyFilters(ctx, f)
  // Coorte: orçamentos emitidos no período, e o que aconteceu com eles
  const emitted = base.filter((q) => inRange(q.issueDate, range))
  const sent = emitted.filter(isSent)
  const approved = emitted.filter((q) => q.status === 'aprovado')
  const refused = emitted.filter((q) => q.status === 'recusado')
  const open = emitted.filter((q) => q.status === 'enviado' && q.validUntil >= ctx.today)
  const expired = emitted.filter((q) => q.status === 'enviado' && q.validUntil < ctx.today)

  // Pela data de aprovação (usa o histórico): quanto foi fechado dentro do período
  const approvedByDate = base.filter((q) => q.status === 'aprovado' && inRange(statusDate(q, 'aprovado'), range))

  // Tempo até a aprovação: só onde o histórico registrou envio e aprovação
  const cycle = approved
    .filter((q) => hasStatusRecord(q, 'aprovado'))
    .map((q) => differenceInCalendarDays(parseDate(statusDate(q, 'aprovado'))!, parseDate(statusDate(q, 'enviado'))!))
    .filter((d) => d >= 0)

  // Série mensal
  const months = monthSpan(range, base)
  const series: MonthPoint[] = months.map((m) => {
    const quotedQs = base.filter((q) => isSent(q) && q.issueDate.startsWith(m))
    const approvedQs = base.filter((q) => q.status === 'aprovado' && statusDate(q, 'aprovado').startsWith(m))
    return {
      month: m,
      label: format(parseDate(`${m}-01`)!, 'MMM/yy', { locale: ptBR }).replace('.', ''),
      quoted: sumTotals(quotedQs),
      approved: sumTotals(approvedQs),
      quotedCount: quotedQs.length,
      approvedCount: approvedQs.length,
    }
  })

  return {
    created: { count: emitted.length },
    sent: { count: sent.length, value: sumTotals(sent) },
    approved: { count: approved.length, value: sumTotals(approved) },
    refused: { count: refused.length, value: sumTotals(refused) },
    open: { count: open.length, value: sumTotals(open) },
    expired: { count: expired.length, value: sumTotals(expired) },
    approvalRate: rate(approved.length, sent.length),
    avgTicket: approved.length ? sumTotals(approved) / approved.length : null,
    approvedByDate: { count: approvedByDate.length, value: sumTotals(approvedByDate) },
    avgDaysToApprove: cycle.length ? Math.round(cycle.reduce((a, b) => a + b, 0) / cycle.length) : null,
    series,
  }
}

/** Meses (yyyy-MM) cobertos pelo período; em "todo o período", do primeiro orçamento até hoje (máx. 36) */
function monthSpan(range: { from: string | null; to: string | null }, quotes: Quote[]): string[] {
  const today = new Date()
  const first = quotes.reduce<string | null>((min, q) => (!min || q.issueDate < min ? q.issueDate : min), null)
  const start = parseDate(range.from ?? first ?? toISODate(today))!
  let end = parseDate(range.to ?? toISODate(today))!
  if (end > endOfMonth(today) && !range.to) end = today
  const out: string[] = []
  for (let d = startOfMonth(start); d <= end && out.length < 120; d = addMonths(d, 1)) out.push(format(d, 'yyyy-MM'))
  return out.slice(-36)
}

/* ------------------------------------------------------------------ */
/* Follow-up                                                           */
/* ------------------------------------------------------------------ */

export interface FollowUpRow {
  quote: Quote
  total: number
  sentOn: string
  daysSinceSent: number
  daysToExpire: number // negativo = vencido há N dias
  group: 'vencido' | 'vencendo' | 'aberto'
}

/** Orçamentos enviados aguardando resposta (ignora período e status) */
export function followUpReport(ctx: ReportContext, f: ReportFilters, windowDays: number): FollowUpRow[] {
  const today = parseDate(ctx.today)!
  return applyFilters(ctx, f, { ignoreStatus: true })
    .filter((q) => q.status === 'enviado')
    .map((q) => {
      const sentOn = statusDate(q, 'enviado')
      const daysToExpire = differenceInCalendarDays(parseDate(q.validUntil)!, today)
      return {
        quote: q,
        total: quoteTotals(q).total,
        sentOn,
        daysSinceSent: differenceInCalendarDays(today, parseDate(sentOn)!),
        daysToExpire,
        group: daysToExpire < 0 ? 'vencido' : daysToExpire <= windowDays ? 'vencendo' : 'aberto',
      } satisfies FollowUpRow
    })
    .sort((a, b) => a.daysToExpire - b.daysToExpire)
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

export interface ClientRow {
  key: string
  clientId: string | null
  name: string
  phone: string
  count: number
  sent: number
  approved: number
  refused: number
  approvalRate: number | null
  quotedValue: number
  approvedValue: number
  avgTicket: number | null
  lastIssue: string
}

export function clientsReport(ctx: ReportContext, f: ReportFilters): ClientRow[] {
  const range = periodRange(f)
  const keyOf = makeClientKeyOf(ctx.clients)
  const quotes = applyFilters(ctx, f).filter((q) => inRange(q.issueDate, range))
  const groups = new Map<string, Quote[]>()
  for (const q of quotes) {
    const k = keyOf(q)
    groups.set(k, [...(groups.get(k) ?? []), q])
  }
  return [...groups].map(([key, qs]) => {
    const registered = key.startsWith('id:') ? ctx.clients.find((c) => c.id === key.slice(3)) : undefined
    const latest = qs.toSorted((a, b) => b.issueDate.localeCompare(a.issueDate))[0]
    const sent = qs.filter(isSent)
    const approved = qs.filter((q) => q.status === 'aprovado')
    return {
      key,
      clientId: registered?.id ?? null,
      name: registered?.name ?? (latest.client.name || 'Sem cliente'),
      phone: registered?.phone ?? latest.client.phone,
      count: qs.length,
      sent: sent.length,
      approved: approved.length,
      refused: qs.filter((q) => q.status === 'recusado').length,
      approvalRate: rate(approved.length, sent.length),
      quotedValue: sumTotals(sent),
      approvedValue: sumTotals(approved),
      avgTicket: approved.length ? sumTotals(approved) / approved.length : null,
      lastIssue: latest.issueDate,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Serviços                                                            */
/* ------------------------------------------------------------------ */

export interface ServiceRow {
  key: string
  name: string
  unit: string
  inCatalog: boolean
  quotes: number
  approvedQuotes: number
  qtyQuoted: number
  qtyApproved: number
  quotedValue: number
  approvedValue: number
  avgPrice: number
  catalogPrice: number | null
  /** preço médio praticado vs. preço de catálogo (0.1 = 10% acima) */
  priceDiff: number | null
}

/** Valores dos itens antes de desconto/acréscimo do orçamento; considera só orçamentos enviados */
export function servicesReport(ctx: ReportContext, f: ReportFilters): ServiceRow[] {
  const range = periodRange(f)
  const quotes = applyFilters(ctx, f).filter((q) => isSent(q) && inRange(q.issueDate, range))
  const names = serviceNames(quotes, ctx.catalog)
  const acc = new Map<
    string,
    { units: Map<string, number>; quotes: Set<string>; approvedQuotes: Set<string> } & Record<
      'qtyQuoted' | 'qtyApproved' | 'quotedValue' | 'approvedValue',
      number
    >
  >()
  for (const q of quotes)
    for (const it of filledItems(q)) {
      const key = serviceKeyOf(it)
      if (f.serviceKey && key !== f.serviceKey) continue
      const a = acc.get(key) ?? {
        units: new Map(),
        quotes: new Set(),
        approvedQuotes: new Set(),
        qtyQuoted: 0,
        qtyApproved: 0,
        quotedValue: 0,
        approvedValue: 0,
      }
      a.units.set(it.unit, (a.units.get(it.unit) ?? 0) + 1)
      a.quotes.add(q.id)
      a.qtyQuoted += it.quantity || 0
      a.quotedValue += itemTotal(it)
      if (q.status === 'aprovado') {
        a.approvedQuotes.add(q.id)
        a.qtyApproved += it.quantity || 0
        a.approvedValue += itemTotal(it)
      }
      acc.set(key, a)
    }
  return [...acc].map(([key, a]) => {
    const cat = key.startsWith('cat:') ? ctx.catalog.find((c) => c.id === key.slice(4)) : undefined
    const avgPrice = a.qtyQuoted ? a.quotedValue / a.qtyQuoted : 0
    const catalogPrice = cat ? cat.unitPrice : null
    return {
      key,
      name: names.get(key) ?? key,
      unit: [...a.units].sort((x, y) => y[1] - x[1])[0][0],
      inCatalog: !!cat,
      quotes: a.quotes.size,
      approvedQuotes: a.approvedQuotes.size,
      qtyQuoted: a.qtyQuoted,
      qtyApproved: a.qtyApproved,
      quotedValue: a.quotedValue,
      approvedValue: a.approvedValue,
      avgPrice,
      catalogPrice,
      priceDiff: catalogPrice ? avgPrice / catalogPrice - 1 : null,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Descontos                                                           */
/* ------------------------------------------------------------------ */

export interface DiscountRow {
  quote: Quote
  clientKey: string
  clientName: string
  subtotal: number
  discount: number
  percent: number
  total: number
}

export function discountsReport(ctx: ReportContext, f: ReportFilters) {
  const range = periodRange(f)
  const keyOf = makeClientKeyOf(ctx.clients)
  const sent = applyFilters(ctx, f).filter((q) => isSent(q) && inRange(q.issueDate, range))
  const rows: DiscountRow[] = sent
    .map((q) => {
      const t = quoteTotals(q)
      return {
        quote: q,
        clientKey: keyOf(q),
        clientName: q.client.name || 'Sem cliente',
        subtotal: t.subtotal,
        discount: t.discountValue,
        percent: t.subtotal ? t.discountValue / t.subtotal : 0,
        total: t.total,
      }
    })
    .filter((r) => r.discount > 0)

  const approvedRows = rows.filter((r) => r.quote.status === 'aprovado')
  const sum = (rs: DiscountRow[], k: 'discount' | 'subtotal') => rs.reduce((a, r) => a + r[k], 0)

  const byClient = new Map<string, { name: string; count: number; discount: number; subtotal: number }>()
  for (const r of rows) {
    const c = byClient.get(r.clientKey) ?? { name: r.clientName, count: 0, discount: 0, subtotal: 0 }
    c.count++
    c.discount += r.discount
    c.subtotal += r.subtotal
    byClient.set(r.clientKey, c)
  }

  return {
    rows,
    sentCount: sent.length,
    totalDiscount: sum(rows, 'discount'),
    approvedDiscount: sum(approvedRows, 'discount'),
    avgPercent: sum(rows, 'subtotal') ? sum(rows, 'discount') / sum(rows, 'subtotal') : null,
    byClient: [...byClient].map(([key, v]) => ({ key, ...v, percent: v.subtotal ? v.discount / v.subtotal : 0 })),
  }
}
