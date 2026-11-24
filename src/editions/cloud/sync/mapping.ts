import type { DataState } from '../../../data/schema'
import type { CatalogItem, Client, CompanyProfile, Quote, Unit } from '../../../types'
import { formatQuoteNumber } from '../../../store/factories'
import type { Synced } from './diff'
import type { RemoteChanges, Table } from './engine'

/**
 * Tradução entre o store (DataState) e as tabelas do servidor. Puro: o controlador chama estas funções.
 * `activeProfileId` é preferência do dispositivo e não é sincronizado.
 */

/** Registro atual do store para uma linha sincronizável (`null` se não existe mais). */
export function findRecord(s: DataState, table: Table, id: string): Synced | null {
  if (table === 'user_settings') return { id, units: s.units } as Synced
  const list: Synced[] = {
    company_profiles: s.profiles,
    clients: s.clients,
    catalog_items: s.catalog,
    quotes: s.quotes,
  }[table]
  return list.find((x) => x.id === id) ?? null
}

/** Registros do store como linhas sincronizáveis. As unidades de medida viajam numa linha só (id = usuário). */
export function toTables(s: DataState, userId: string): Record<Table, Synced[]> {
  return {
    user_settings: [{ id: userId, units: s.units } as Synced],
    company_profiles: s.profiles,
    clients: s.clients,
    catalog_items: s.catalog,
    quotes: s.quotes,
  }
}

function merge<T extends { id: string }>(
  list: T[],
  { upserts, deletedIds }: RemoteChanges,
  pick: (local: T, remote: T) => T = (_local, remote) => remote,
): T[] {
  const gone = new Set(deletedIds)
  const incoming = new Map(upserts.map((u) => [u.id, u.data as T]))
  const kept = list
    .filter((x) => !gone.has(x.id))
    .map((x) => {
      const remote = incoming.get(x.id)
      if (!remote) return x
      incoming.delete(x.id)
      return pick(x, remote)
    })
  return [...kept, ...incoming.values()]
}

/**
 * Aplica ao store o que veio do servidor. A numeração nunca anda para trás: o servidor só conhece o último valor
 * que algum dispositivo informou, e um dispositivo pode já ter usado números além dele.
 */
export function applyRemote(s: DataState, table: Table, changes: RemoteChanges): Partial<DataState> {
  switch (table) {
    case 'user_settings': {
      const units = (changes.upserts[0]?.data as { units?: Unit[] } | undefined)?.units
      return Array.isArray(units) ? { units } : {}
    }
    case 'company_profiles': {
      const profiles = merge<CompanyProfile>(s.profiles, changes, (local, remote) => ({
        ...remote,
        nextNumber: Math.max(local.nextNumber, remote.nextNumber),
      }))
      const stillThere = profiles.some((p) => p.id === s.activeProfileId)
      return { profiles, activeProfileId: stillThere ? s.activeProfileId : (profiles[0]?.id ?? null) }
    }
    case 'clients':
      return { clients: merge<Client>(s.clients, changes) }
    case 'catalog_items':
      return { catalog: merge<CatalogItem>(s.catalog, changes) }
    case 'quotes': {
      const quotes = merge<Quote>(s.quotes, changes)
      const profiles = withNumberFloor(s.profiles, quotes)
      return profiles.some((p, i) => p !== s.profiles[i]) ? { quotes, profiles } : { quotes }
    }
  }
}

/**
 * Piso da numeração: o próximo número de cada empresa fica acima do maior número já usado nos orçamentos
 * (formato prefixo + dígitos). O servidor só guarda o `nextNumber` de quando a empresa foi criada, então sem isso
 * um dispositivo novo repetiria números que outro já usou. Mantém as referências quando nada muda.
 */
export function withNumberFloor(profiles: CompanyProfile[], quotes: Quote[]): CompanyProfile[] {
  return profiles.map((p) => {
    let max = 0
    for (const q of quotes) {
      if (q.profileId !== p.id || !q.number.startsWith(p.numberPrefix)) continue
      const rest = q.number.slice(p.numberPrefix.length)
      if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest))
    }
    return max >= p.nextNumber ? { ...p, nextNumber: max + 1 } : p
  })
}

/**
 * Orçamentos que o servidor recusou por número repetido (outro dispositivo usou o mesmo número enquanto este
 * estava sem conexão) ganham os próximos números da empresa. Chamar depois do pull, quando o orçamento do outro
 * dispositivo já está no store. Devolve `null` se não houver o que renumerar.
 * ponytail: números sem reserva no servidor; dois dispositivos offline ao mesmo tempo ainda podem se cruzar e
 * renumerar de novo no ciclo seguinte. A reserva em blocos (plano 7.6) elimina isso.
 */
export function renumberQuotes(s: DataState, quoteIds: string[]): Partial<DataState> | null {
  const profiles = withNumberFloor(
    s.profiles,
    s.quotes.filter((q) => !quoteIds.includes(q.id)),
  ).map((p) => ({ ...p }))
  const renumbered = new Map<string, string>()
  for (const q of s.quotes) {
    const profile = profiles.find((p) => p.id === q.profileId)
    if (!quoteIds.includes(q.id) || !profile) continue
    renumbered.set(q.id, formatQuoteNumber(profile.numberPrefix, profile.nextNumber++))
  }
  if (!renumbered.size) return null
  return { profiles, quotes: s.quotes.map((q) => (renumbered.has(q.id) ? { ...q, number: renumbered.get(q.id)! } : q)) }
}
