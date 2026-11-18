import { describe, expect, it } from 'vitest'
import {
  clientsReport,
  defaultFilters,
  discountsReport,
  filterOptions,
  followUpReport,
  overviewReport,
  periodRange,
  servicesReport,
  statusDate,
  type ReportContext,
} from './data'
import { clientToQuoteClient, emptyQuoteClient, newClient, newItem, newProfile, newQuote } from '../store/factories'
import type { Quote, QuoteItem, QuoteStatus, StatusChange } from '../types'

/*
 * Cenário com resultado conhecido (hoje = 18/11/2026; período = set–nov/2026, empresa p1):
 *  A aprovado  (emitido 01/09, enviado 05/09, aprovado 20/10) — Pintura 10 m² × 27 (catálogo: 30), desconto 10%
 *  B enviado   (01/10, venceu 16/10)                          — "Instalação  elétrica" 1 × 500
 *  C enviado   (10/11, vence 23/11) — cliente digitado à mão com o CPF da Maria — "instalacao eletrica" 2 × 400
 *  D recusado  (02/11) — João, sem cadastro                    — Piso 1 × 1000
 *  E rascunho  (15/11)                                          — Piso 1 × 999
 *  F aprovado em 2024 (fora do período) e G aprovado de outra empresa (p2)
 */
const today = '2026-11-18'
const maria = { ...newClient(), id: 'c-maria', name: 'Maria', document: '529.982.247-25', phone: '(11) 91234-5678' }
const catalog = [
  { id: 'cat-pint', description: 'Pintura (m²)', details: '', unit: 'm²', unitPrice: 30, createdAt: '', updatedAt: '' },
]
const profile = { ...newProfile(), id: 'p1' }

function q(o: {
  number: string
  status: QuoteStatus
  issue: string
  valid?: string
  profileId?: string
  history?: StatusChange[]
  client?: Quote['client']
  items: QuoteItem[]
  discount?: Quote['discount']
}): Quote {
  return {
    ...newQuote(profile, o.number),
    profileId: o.profileId ?? 'p1',
    status: o.status,
    statusHistory: o.history ?? [],
    issueDate: o.issue,
    validUntil: o.valid ?? '2026-12-31',
    client: o.client ?? clientToQuoteClient(maria),
    items: o.items,
    discount: o.discount ?? { type: 'percent', value: 0 },
  }
}

const quotes = [
  q({
    number: 'A',
    status: 'aprovado',
    issue: '2026-09-01',
    history: [
      { status: 'rascunho', at: '2026-09-01T12:00:00' },
      { status: 'enviado', at: '2026-09-05T12:00:00' },
      { status: 'aprovado', at: '2026-10-20T12:00:00' },
    ],
    items: [newItem({ catalogId: 'cat-pint', description: 'Pintura sala', unit: 'm²', quantity: 10, unitPrice: 27 })],
    discount: { type: 'percent', value: 10 },
  }),
  q({
    number: 'B',
    status: 'enviado',
    issue: '2026-10-01',
    valid: '2026-10-16',
    items: [newItem({ description: 'Instalação  elétrica', quantity: 1, unitPrice: 500 })],
  }),
  q({
    number: 'C',
    status: 'enviado',
    issue: '2026-11-10',
    valid: '2026-11-23',
    client: { ...emptyQuoteClient(), name: 'Maria O.', document: '52998224725' },
    items: [newItem({ description: 'instalacao eletrica', quantity: 2, unitPrice: 400 })],
  }),
  q({
    number: 'D',
    status: 'recusado',
    issue: '2026-11-02',
    client: { ...emptyQuoteClient(), name: 'João' },
    items: [newItem({ description: 'Piso', quantity: 1, unitPrice: 1000 })],
  }),
  q({
    number: 'E',
    status: 'rascunho',
    issue: '2026-11-15',
    items: [newItem({ description: 'Piso', unitPrice: 999 })],
  }),
  q({
    number: 'F',
    status: 'aprovado',
    issue: '2024-01-10',
    items: [newItem({ description: 'Velho', unitPrice: 100 })],
  }),
  q({
    number: 'G',
    status: 'aprovado',
    issue: '2026-11-01',
    profileId: 'p2',
    items: [newItem({ description: 'Outra empresa', unitPrice: 7777 })],
  }),
]

const ctx: ReportContext = { quotes, clients: [maria], catalog, today }
const f = { ...defaultFilters('p1'), preset: 'custom' as const, from: '2026-09-01', to: '2026-11-30' }

describe('períodos', () => {
  const now = new Date(2026, 10, 18)
  it.each([
    ['mes', { from: '2026-11-01', to: '2026-11-30' }],
    ['mes-anterior', { from: '2026-10-01', to: '2026-10-31' }],
    ['trimestre', { from: '2026-09-01', to: '2026-11-30' }],
    ['ano', { from: '2026-01-01', to: '2026-12-31' }],
    ['12m', { from: '2025-12-01', to: '2026-11-30' }],
    ['tudo', { from: null, to: null }],
  ] as const)('%s', (preset, expected) => {
    expect(periodRange({ preset, from: '', to: '' }, now)).toEqual(expected)
  })
})

describe('statusDate', () => {
  it('usa o histórico e, sem ele, a data de emissão', () => {
    expect(statusDate(quotes[0], 'aprovado')).toBe('2026-10-20')
    expect(statusDate(quotes[1], 'enviado')).toBe('2026-10-01')
  })
})

describe('visão geral', () => {
  const o = overviewReport(ctx, f)
  it('conta a coorte de orçamentos emitidos no período', () => {
    expect(o.created.count).toBe(5)
    expect(o.sent.count).toBe(4)
    expect(o.approved).toEqual({ count: 1, value: 243 })
    expect(o.refused.count).toBe(1)
    expect(o.expired.count).toBe(1)
    expect(o.open.count).toBe(1)
  })
  it('taxa de aprovação = aprovados ÷ enviados; tempo até aprovar pelo histórico', () => {
    expect(o.approvalRate).toBe(0.25)
    expect(o.avgDaysToApprove).toBe(45)
  })
  it('série mensal: orçado por emissão, aprovado por data de aprovação', () => {
    expect(o.series.map((m) => [m.month, m.quoted, m.approved])).toEqual([
      ['2026-09', 243, 0],
      ['2026-10', 500, 243],
      ['2026-11', 1800, 0],
    ])
  })
})

describe('follow-up', () => {
  it('lista só enviados, do mais vencido para o mais distante', () => {
    expect(followUpReport(ctx, f, 7).map((r) => [r.quote.number, r.group, r.daysToExpire])).toEqual([
      ['B', 'vencido', -33],
      ['C', 'vencendo', 5],
    ])
  })
  it('ignora o filtro de status', () => {
    expect(followUpReport(ctx, { ...f, statuses: ['aprovado'] }, 7)).toHaveLength(2)
  })
})

describe('clientes', () => {
  const rows = clientsReport(ctx, f)
  it('agrupa orçamento vinculado e orçamento com o mesmo CPF digitado à mão', () => {
    const m = rows.find((r) => r.key === 'id:c-maria')!
    expect([m.count, m.sent, m.approved]).toEqual([4, 3, 1])
  })
  it('mantém clientes sem cadastro separados', () => {
    expect(rows.find((r) => r.name === 'João')?.clientId).toBeNull()
  })
})

describe('serviços', () => {
  const rows = servicesReport(ctx, f)
  it('agrupa descrições iguais ignorando acentos, maiúsculas e espaços', () => {
    const el = rows.find((r) => r.key === 'txt:instalacao eletrica')!
    expect([el.qtyQuoted, el.quotedValue]).toEqual([3, 1300])
  })
  it('usa o nome do catálogo e compara com o preço de catálogo', () => {
    const pint = rows.find((r) => r.key === 'cat:cat-pint')!
    expect(pint.name).toBe('Pintura (m²)')
    expect(pint.approvedValue).toBe(270)
    expect(pint.priceDiff).toBeCloseTo(-0.1)
  })
  it('não considera rascunhos', () => {
    expect(rows.find((r) => r.key === 'txt:piso')?.quotedValue).toBe(1000)
  })
})

describe('descontos', () => {
  it('soma os descontos dos enviados', () => {
    const d = discountsReport(ctx, f)
    expect([d.rows.length, d.totalDiscount, d.avgPercent]).toEqual([1, 27, 0.1])
  })
})

describe('filtros', () => {
  it.each([
    ['cliente', { clientKey: 'id:c-maria' }, (o: ReturnType<typeof overviewReport>) => o.sent.count, 3],
    ['serviço', { serviceKey: 'txt:piso' }, (o: ReturnType<typeof overviewReport>) => o.created.count, 2],
    ['valor mínimo', { minValue: 600 }, (o: ReturnType<typeof overviewReport>) => o.sent.count, 2],
    ['todas as empresas', { profileId: '' }, (o: ReturnType<typeof overviewReport>) => o.approved.value, 243 + 7777],
    ['todo o período', { preset: 'tudo' }, (o: ReturnType<typeof overviewReport>) => o.approved.count, 2],
  ] as const)('%s', (_, patch, pick, expected) => {
    expect(pick(overviewReport(ctx, { ...f, ...patch }))).toBe(expected)
  })

  it('opções de cliente vêm dos orçamentos da empresa', () => {
    expect(filterOptions(ctx, 'p1').clients.map((c) => c.label)).toEqual(['João', 'Maria'])
  })
})
