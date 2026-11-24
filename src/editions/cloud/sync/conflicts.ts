import { diffArrays, diffWords } from 'diff'
import { formatDate } from '../../../lib/format'
import { fingerprint } from './diff'
import type { ConflictRecord, RemoteChanges, Table } from './engine'

/**
 * Lógica da tela de conflitos (pura, testada sem navegador):
 * - `compareRecords`: mescla em três vias por campo (base × sua × nuvem), como no VS Code;
 * - `buildMerged`: monta o registro final a partir das escolhas;
 * - `toLines` + `sideBySide`: texto legível e diff lado a lado (jsdiff) para a tela.
 */

export type Rec = Record<string, unknown>
export type Choice = 'local' | 'server'

/** Campos técnicos: não são mostrados nem entram na comparação (o servidor controla ou não há o que decidir). */
const HIDDEN = new Set(['id', 'catalogId', 'clientId', 'createdAt', 'updatedAt', 'nextNumber'])

/** `pai.campo` vale só dentro daquele pai (ex.: `extras.label` ≠ `label` da empresa). */
export const LABELS: Record<string, string> = {
  label: 'Nome curto',
  docType: 'Tipo de documento',
  document: 'Documento',
  legalName: 'Razão social',
  tradeName: 'Nome fantasia',
  stateRegistration: 'Inscrição estadual',
  municipalRegistration: 'Inscrição municipal',
  address: 'Endereço',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  website: 'Site',
  pixKeyType: 'Tipo da chave Pix',
  pixKey: 'Chave Pix',
  bank: 'Dados bancários',
  'bank.bank': 'Banco',
  agency: 'Agência',
  account: 'Conta',
  accountType: 'Tipo de conta',
  holder: 'Titular',
  showBankInfo: 'Mostrar dados bancários',
  defaultValidityDays: 'Validade padrão (dias)',
  defaultPaymentTerms: 'Forma de pagamento padrão',
  defaultNotes: 'Observações padrão',
  numberPrefix: 'Prefixo da numeração',
  name: 'Nome',
  contactName: 'Contato',
  notes: 'Observações',
  description: 'Descrição',
  details: 'Detalhes',
  unit: 'Unidade',
  unitPrice: 'Preço unitário',
  quantity: 'Quantidade',
  title: 'Título',
  number: 'Número',
  status: 'Status',
  statusHistory: 'Histórico de status',
  'statusHistory.at': 'Em',
  issueDate: 'Emissão',
  validUntil: 'Validade',
  client: 'Cliente',
  items: 'Itens',
  discount: 'Desconto',
  'discount.type': 'Tipo',
  'discount.value': 'Valor',
  extras: 'Acréscimos',
  'extras.label': 'Descrição',
  'extras.value': 'Valor',
  paymentTerms: 'Forma de pagamento',
  executionTime: 'Prazo de execução',
  units: 'Unidades de medida',
  symbol: 'Símbolo',
  cep: 'CEP',
  street: 'Rua',
  complement: 'Complemento',
  district: 'Bairro',
  city: 'Cidade',
  state: 'UF',
}

export const TABLE_LABEL: Record<Table, string> = {
  user_settings: 'Ajustes',
  company_profiles: 'Empresa',
  clients: 'Cliente',
  catalog_items: 'Serviço',
  quotes: 'Orçamento',
}

export const labelOf = (key: string, parent = '') => LABELS[`${parent}.${key}`] ?? LABELS[key] ?? key
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isEmpty = (v: unknown) => v === null || v === undefined || v === ''
const same = (a: unknown, b: unknown) => fingerprint(a) === fingerprint(b)

function scalar(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s, 'dd/MM/yyyy HH:mm')
  return s
}

/**
 * Valor de um campo como linhas de texto legíveis (rótulos em português, datas formatadas, sem ids).
 * Vazio vira lista vazia (a tela mostra "(vazio)").
 */
export function toLines(value: unknown, parent = '', depth = 0): string[] {
  if (isEmpty(value)) return []
  const pad = '  '.repeat(depth)
  if (Array.isArray(value)) {
    return value.flatMap((v, i) =>
      isObj(v) ? [`${pad}${i + 1}.`, ...toLines(v, parent, depth + 1)] : isEmpty(v) ? [] : [`${pad}${scalar(v)}`],
    )
  }
  if (isObj(value)) {
    return Object.entries(value).flatMap(([k, v]) => {
      if (HIDDEN.has(k) || isEmpty(v)) return []
      const label = labelOf(k, parent)
      if (typeof v === 'object') {
        const inner = toLines(v, k, depth + 1)
        return inner.length ? [`${pad}${label}:`, ...inner] : []
      }
      return [`${pad}${label}: ${scalar(v)}`]
    })
  }
  return scalar(value).split('\n')
}

export interface FieldConflict {
  key: string
  label: string
  local: unknown
  server: unknown
}

export interface Comparison {
  /** Campos em que os dois lados mudaram de forma diferente: a pessoa escolhe */
  conflicts: FieldConflict[]
  /** Campos que só a pessoa mudou (a nuvem não): ficam como ela deixou, sem perguntar */
  auto: string[]
}

/**
 * Mescla em três vias, campo a campo (nível superior do registro). Sem versão-base, qualquer diferença é conflito.
 * `statusHistory` acompanha `status`: escolher o status de um lado leva junto o histórico daquele lado.
 */
export function compareRecords(base: Rec | null, local: Rec, server: Rec): Comparison {
  const keys = new Set([...Object.keys(local), ...Object.keys(server)])
  const conflicts: FieldConflict[] = []
  const auto: string[] = []
  for (const key of keys) {
    if (HIDDEN.has(key) || same(local[key], server[key])) continue
    if (base && same(base[key], server[key]))
      auto.push(key) // só o lado local mudou
    else if (base && same(base[key], local[key]))
      continue // só a nuvem mudou: já está no app
    else conflicts.push({ key, label: labelOf(key), local: local[key], server: server[key] })
  }
  if (conflicts.some((c) => c.key === 'status')) {
    return {
      conflicts: conflicts.filter((c) => c.key !== 'statusHistory'),
      auto: auto.filter((k) => k !== 'statusHistory'),
    }
  }
  return { conflicts, auto }
}

/** Registro final: parte do que está no app agora, aplica o que só você mudou e as escolhas dos campos em conflito. */
export function buildMerged(current: Rec, local: Rec, cmp: Comparison, choices: Record<string, Choice>, server: Rec) {
  const out: Rec = { ...current }
  for (const key of cmp.auto) out[key] = local[key]
  for (const f of cmp.conflicts) {
    const from = choices[f.key] === 'local' ? local : server
    out[f.key] = from[f.key]
    if (f.key === 'status') out.statusHistory = from.statusHistory
  }
  return out
}

export function titleOf(table: Table, rec: Rec | null): string {
  if (!rec) return 'Item excluído'
  const text = (k: string) => (typeof rec[k] === 'string' ? (rec[k] as string).trim() : '')
  switch (table) {
    case 'quotes': {
      const name = isObj(rec.client) && typeof rec.client.name === 'string' ? rec.client.name.trim() : ''
      return [text('number'), name].filter(Boolean).join(' · ') || 'Orçamento'
    }
    case 'clients':
      return text('name') || 'Cliente'
    case 'company_profiles':
      return text('label') || text('tradeName') || text('legalName') || 'Empresa'
    case 'catalog_items':
      return text('description') || 'Serviço'
    case 'user_settings':
      return 'Unidades de medida'
  }
}

export interface Seg {
  text: string
  /** trecho que mudou dentro da linha (destaque mais forte) */
  hl: boolean
}
export interface DiffLine {
  kind: 'same' | 'del' | 'add'
  segs: Seg[]
}

const sameLine = (text: string): DiffLine => ({ kind: 'same', segs: [{ text, hl: false }] })

/**
 * Diff lado a lado: esquerda = nuvem (o que sai, em vermelho), direita = sua versão (o que entra, em verde).
 * Linhas trocadas por outras (mesma posição no bloco) mostram só as palavras que mudaram em destaque.
 */
export function sideBySide(serverLines: string[], localLines: string[]) {
  const left: DiffLine[] = []
  const right: DiffLine[] = []
  const parts = diffArrays(serverLines, localLines)
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part.added && !part.removed) {
      for (const l of part.value) {
        left.push(sameLine(l))
        right.push(sameLine(l))
      }
      continue
    }
    const next = parts[i + 1]
    const removed = part.removed ? part.value : []
    const added = part.added ? part.value : part.removed && next?.added ? next.value : []
    if (part.removed && next?.added) i++
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      const o = removed[j]
      const a = added[j]
      if (o !== undefined && a !== undefined) {
        const words = diffWords(o, a)
        left.push({ kind: 'del', segs: words.filter((w) => !w.added).map((w) => ({ text: w.value, hl: !!w.removed })) })
        right.push({
          kind: 'add',
          segs: words.filter((w) => !w.removed).map((w) => ({ text: w.value, hl: !!w.added })),
        })
      } else if (o !== undefined) {
        left.push({ kind: 'del', segs: [{ text: o, hl: true }] })
      } else if (a !== undefined) {
        right.push({ kind: 'add', segs: [{ text: a, hl: true }] })
      }
    }
  }
  return { left, right }
}

/** Chave da escolha quando o conflito é o item inteiro (um lado excluiu), e não campos. */
export const ITEM = '_item'

export interface Plan {
  /** Mudança a aplicar ao store (por quem decide: a escolha da pessoa); `null` = nada a mudar */
  apply: RemoteChanges | null
  /** Manter a própria versão de um item excluído na nuvem: o motor recria o item no próximo envio */
  revive: boolean
}

const NOTHING: Plan = { apply: null, revive: false }

/**
 * O que fazer no store para cada decisão. A versão da nuvem já está no app quando o conflito aparece, então
 * "escolher a da nuvem" em tudo não muda nada. `current` = registro atual do store (ou `null`).
 * Registros gravados por versões antigas (sem `server`) usam o registro atual como versão da nuvem.
 */
export function planResolution(c: ConflictRecord, current: Rec | null, choices: Record<string, Choice>): Plan {
  if (c.local === undefined) return NOTHING
  const wantsLocal = choices[ITEM] === 'local'
  if (c.local === null) {
    return wantsLocal ? { apply: { upserts: [], deletedIds: [c.id] }, revive: false } : NOTHING
  }
  if (c.server === null) {
    return wantsLocal ? { apply: { upserts: [{ id: c.id, data: c.local }], deletedIds: [] }, revive: true } : NOTHING
  }
  const server = (c.server ?? current) as Rec | null
  if (!server) return NOTHING
  const local = c.local as Rec
  const cmp = compareRecords((c.base ?? null) as Rec | null, local, server)
  const merged = buildMerged(current ?? server, local, cmp, choices, server)
  return { apply: { upserts: [{ id: c.id, data: merged }], deletedIds: [] }, revive: false }
}

/**
 * Conflito que não precisa de decisão: os dois lados mudaram campos diferentes. A mescla é feita sozinha e a
 * pessoa só fica sabendo se quiser; perguntar aqui seria ruído.
 */
export function autoResolvable(c: ConflictRecord): boolean {
  if (c.local === undefined || c.local === null || c.server === null || c.server === undefined) return false
  return compareRecords((c.base ?? null) as Rec | null, c.local as Rec, c.server as Rec).conflicts.length === 0
}
