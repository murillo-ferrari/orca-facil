import { addDays } from 'date-fns'
import type { Address, Client, CompanyProfile, Quote, QuoteClient, QuoteItem, Unit } from '../types'
import { toISODate } from '../lib/format'

/**
 * UUID v4. Na Cloud o `id` precisa ser UUID (é a chave no Postgres). `randomUUID` só existe em contexto seguro
 * (https/localhost); fora dele, `getRandomValues` funciona em qualquer lugar.
 */
export const uid = () => {
  // `randomUUID` é opcional em runtime (contexto não seguro), mas o tipo do DOM o declara sempre presente
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const nowISO = () => new Date().toISOString()

export const emptyAddress = (): Address => ({
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
})

export function newProfile(): CompanyProfile {
  const now = nowISO()
  return {
    id: uid(),
    label: '',
    docType: 'CNPJ',
    document: '',
    legalName: '',
    tradeName: '',
    stateRegistration: '',
    municipalRegistration: '',
    address: emptyAddress(),
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    pixKeyType: 'CNPJ',
    pixKey: '',
    bank: { bank: '', agency: '', account: '', accountType: 'Corrente', holder: '' },
    showBankInfo: true,
    defaultValidityDays: 15,
    defaultPaymentTerms: '',
    defaultNotes: '',
    numberPrefix: 'ORC-',
    nextNumber: 1,
    createdAt: now,
    updatedAt: now,
  }
}

export function newClient(): Client {
  const now = nowISO()
  return {
    id: uid(),
    name: '',
    docType: 'CPF',
    document: '',
    contactName: '',
    email: '',
    phone: '',
    address: emptyAddress(),
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export const emptyQuoteClient = (): QuoteClient => ({
  clientId: null,
  name: '',
  docType: 'CPF',
  document: '',
  contactName: '',
  email: '',
  phone: '',
  address: emptyAddress(),
})

export const clientToQuoteClient = (c: Client): QuoteClient => ({
  clientId: c.id,
  name: c.name,
  docType: c.docType,
  document: c.document,
  contactName: c.contactName,
  email: c.email,
  phone: c.phone,
  address: { ...c.address },
})

export const newItem = (partial: Partial<QuoteItem> = {}): QuoteItem => ({
  id: uid(),
  catalogId: null,
  description: '',
  details: '',
  unit: 'un',
  quantity: 1,
  unitPrice: 0,
  ...partial,
})

export const formatQuoteNumber = (prefix: string, n: number) => `${prefix}${String(n).padStart(4, '0')}`

export function newQuote(profile: CompanyProfile, number: string): Quote {
  const now = nowISO()
  const today = new Date()
  return {
    id: uid(),
    profileId: profile.id,
    number,
    title: '',
    status: 'rascunho',
    statusHistory: [{ status: 'rascunho', at: now }],
    issueDate: toISODate(today),
    validUntil: toISODate(addDays(today, profile.defaultValidityDays || 15)),
    client: emptyQuoteClient(),
    items: [newItem()],
    discount: { type: 'percent', value: 0 },
    extras: [],
    paymentTerms: profile.defaultPaymentTerms,
    executionTime: '',
    notes: profile.defaultNotes,
    createdAt: now,
    updatedAt: now,
  }
}

export const DEFAULT_UNITS: Unit[] = [
  ['un', 'Unidade'],
  ['h', 'Hora'],
  ['dia', 'Diária'],
  ['mês', 'Mês'],
  ['serv', 'Serviço'],
  ['vb', 'Verba'],
  ['m', 'Metro linear'],
  ['m²', 'Metro quadrado'],
  ['m³', 'Metro cúbico'],
  ['kg', 'Quilograma'],
  ['L', 'Litro'],
  ['km', 'Quilômetro'],
  ['pç', 'Peça'],
  ['cx', 'Caixa'],
  ['kit', 'Kit'],
].map(([symbol, name]) => ({ id: uid(), symbol, name }))

/** Completa campos adicionados em versões novas (dados antigos do localStorage ou backups) */
export function normalizeQuote(q: Quote): Quote {
  return {
    ...q,
    statusHistory: Array.isArray(q.statusHistory) ? q.statusHistory : [],
    items: (q.items ?? []).map((it) => ({ ...it, catalogId: it.catalogId ?? null })),
    extras: q.extras ?? [],
  }
}
