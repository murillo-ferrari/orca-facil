import type { CompanyProfile } from '../types'
import { formatCurrency, formatDate } from '../lib/format'
import { STATUS } from '../lib/status'
import { PERIOD_LABELS, periodRange, type Option, type ReportFilters } from './data'

export interface FilterAvailability {
  period?: string | false // texto explica por que está desativado
  status?: string | false
}

export const profileName = (p: CompanyProfile) => p.label || p.tradeName || p.legalName

/** Resumo legível dos filtros ativos (cabeçalho de impressão) */
export function describeFilters(
  f: ReportFilters,
  profiles: CompanyProfile[],
  opts: { clients: Option[]; services: Option[] },
  availability: FilterAvailability = {},
): string[] {
  const out: string[] = []
  const p = profiles.find((x) => x.id === f.profileId)
  out.push(`Empresa: ${p ? profileName(p) : 'todas'}`)
  if (!availability.period) {
    const r = periodRange(f)
    out.push(
      `Período (emissão): ${PERIOD_LABELS[f.preset]}${
        r.from || r.to ? ` — ${r.from ? formatDate(r.from) : 'início'} a ${r.to ? formatDate(r.to) : 'hoje'}` : ''
      }`,
    )
  }
  if (!availability.status && f.statuses.length)
    out.push(`Status: ${f.statuses.map((s) => STATUS[s].label).join(', ')}`)
  if (f.clientKey) out.push(`Cliente: ${opts.clients.find((c) => c.value === f.clientKey)?.label ?? '—'}`)
  if (f.serviceKey) out.push(`Serviço: ${opts.services.find((c) => c.value === f.serviceKey)?.label ?? '—'}`)
  if (f.minValue !== null) out.push(`Valor mínimo: ${formatCurrency(f.minValue)}`)
  if (f.maxValue !== null) out.push(`Valor máximo: ${formatCurrency(f.maxValue)}`)
  return out
}
