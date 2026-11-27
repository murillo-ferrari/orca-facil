export type DocType = 'CPF' | 'CNPJ'

export interface Address {
  cep: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

export type PixKeyType = 'CPF' | 'CNPJ' | 'E-mail' | 'Telefone' | 'Aleatória'

export interface BankInfo {
  bank: string
  agency: string
  account: string
  accountType: 'Corrente' | 'Poupança' | 'Pagamento'
  holder: string
}

/** Aparência do PDF (plano Pro). Ausente em dados antigos. */
export interface Branding {
  /** PNG ou JPEG em data URL, já reduzido para caber no registro (ver `lib/logo.ts`) */
  logo: string | null
  /** Cor de destaque `#rrggbb`; null = visual padrão (grafite) */
  accent: string | null
}

export interface CompanyProfile {
  id: string
  /** Nome curto exibido no seletor do app */
  label: string
  docType: DocType
  document: string
  legalName: string
  tradeName: string
  stateRegistration: string
  municipalRegistration: string
  address: Address
  phone: string
  whatsapp: string
  email: string
  website: string
  pixKeyType: PixKeyType
  pixKey: string
  bank: BankInfo
  showBankInfo: boolean
  branding?: Branding
  defaultValidityDays: number
  defaultPaymentTerms: string
  defaultNotes: string
  numberPrefix: string
  nextNumber: number
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  docType: DocType
  document: string
  contactName: string
  email: string
  phone: string
  address: Address
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Unit {
  id: string
  symbol: string
  name: string
}

export interface CatalogItem {
  id: string
  description: string
  details: string
  unit: string
  unitPrice: number
  createdAt: string
  updatedAt: string
}

export interface QuoteItem {
  id: string
  /** Item do catálogo de onde o item veio (permite agrupar nos relatórios mesmo com descrição editada) */
  catalogId: string | null
  description: string
  details: string
  unit: string
  quantity: number
  unitPrice: number
}

export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado'

export interface StatusChange {
  status: QuoteStatus
  at: string // ISO datetime
}

export interface Adjustment {
  type: 'percent' | 'value'
  value: number
}

export interface ExtraCharge {
  id: string
  label: string
  value: number
}

/** Cópia dos dados do cliente no momento do orçamento */
export interface QuoteClient {
  clientId: string | null
  name: string
  docType: DocType
  document: string
  contactName: string
  email: string
  phone: string
  address: Address
}

export interface Quote {
  id: string
  profileId: string
  number: string
  title: string
  status: QuoteStatus
  /** Histórico de mudanças de status (registrado a partir da v2; orçamentos antigos podem não ter) */
  statusHistory: StatusChange[]
  issueDate: string // yyyy-MM-dd
  validUntil: string // yyyy-MM-dd
  client: QuoteClient
  items: QuoteItem[]
  discount: Adjustment
  extras: ExtraCharge[]
  paymentTerms: string
  executionTime: string
  notes: string
  createdAt: string
  updatedAt: string
}
