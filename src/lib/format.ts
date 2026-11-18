import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import type { Address, DocType } from '../types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export const formatCurrency = (value: number) => brl.format(Number.isFinite(value) ? value : 0)
export const formatNumber = (value: number) => num.format(Number.isFinite(value) ? value : 0)

export const onlyDigits = (s: string) => s.replace(/\D/g, '')

function applyMask(digits: string, mask: string) {
  let out = ''
  let i = 0
  for (const ch of mask) {
    if (i >= digits.length) break
    if (ch === '#') out += digits[i++]
    else out += ch
  }
  return out
}

export const maskCPF = (v: string) => applyMask(onlyDigits(v).slice(0, 11), '###.###.###-##')
export const maskCNPJ = (v: string) => applyMask(onlyDigits(v).slice(0, 14), '##.###.###/####-##')
export const maskDoc = (v: string, type: DocType) => (type === 'CPF' ? maskCPF(v) : maskCNPJ(v))
export const maskCEP = (v: string) => applyMask(onlyDigits(v).slice(0, 8), '#####-###')
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 10) return applyMask(d, '(##) ####-####')
  return applyMask(d, '(##) #####-####')
}

export function isValidCPF(v: string) {
  const d = onlyDigits(v)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function isValidCNPJ(v: string) {
  const d = onlyDigits(v)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export const isValidDoc = (v: string, type: DocType) => (type === 'CPF' ? isValidCPF(v) : isValidCNPJ(v))

export function parseDate(iso: string): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso)
  return isValid(d) ? d : undefined
}

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayISO = () => toISODate(new Date())

export function formatDate(iso: string, pattern = 'dd/MM/yyyy') {
  const d = parseDate(iso)
  return d ? format(d, pattern, { locale: ptBR }) : ''
}

export function formatDateLong(iso: string) {
  return formatDate(iso, "d 'de' MMMM 'de' yyyy")
}

export function formatAddressLines(a: Address): string[] {
  const line1 = [a.street, a.number].filter(Boolean).join(', ') + (a.complement ? ` - ${a.complement}` : '')
  const cityState = [a.city, a.state].filter(Boolean).join('/')
  const line2 = [a.district, cityState].filter(Boolean).join(' - ') + (a.cep ? ` - CEP ${a.cep}` : '')
  return [line1.trim(), line2.trim()].filter(Boolean)
}

export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Converte texto digitado no padrão brasileiro ("1.234,56" ou "1234.56") em número */
export function parseBRNumber(text: string): number {
  let t = text.replace(/[^\d,.-]/g, '')
  if (!t) return 0
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = t.replace(/\./g, '')
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
/** Percentual em pt-BR a partir de fração (0.333 → "33,3%"); null vira "—" */
export const formatPercent = (v: number | null) => (v === null ? '—' : pct.format(v))
