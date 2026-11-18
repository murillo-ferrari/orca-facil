import { addDays } from 'date-fns'
import type { Address, Client, CompanyProfile, Quote, QuoteClient, QuoteItem, Unit } from '../types'
import { toISODate } from '../lib/format'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

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
