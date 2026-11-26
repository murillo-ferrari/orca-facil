import { STORAGE_KEY, migrateState, normalizeImport, type DataState } from '../../../data/schema'
import type { Unit } from '../../../types'

/**
 * Migração da edição Local para a Cloud (plano, seção 8). Puro: lê/decide/junta sem tocar no store nem na rede.
 *
 * A Cloud nunca envia nada sozinha. Estas funções só preparam o que a pessoa vai confirmar na tela.
 */

/** Dados guardados pela edição Local neste navegador (`gerador-orcamento:v1`), já na versão atual do formato. */
export function readLocalEdition(storage: Pick<Storage, 'getItem'> = localStorage): DataState | null {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return null // localStorage bloqueado (janela privativa, política do navegador)
  }
  if (!raw) return null
  try {
    // O persist do zustand guarda `{ state, version }`
    const saved = JSON.parse(raw) as { state?: Partial<DataState>; version?: number } | null
    if (!saved?.state) return null
    const data = migrateState(saved.state, saved.version ?? 0)
    return hasContent(data) ? data : null
  } catch {
    return null
  }
}

/** Há algo que valha a pena migrar (as unidades padrão sozinhas não valem). */
export function hasContent(d: Pick<DataState, 'profiles' | 'clients' | 'catalog' | 'quotes'>) {
  return d.profiles.length + d.clients.length + d.catalog.length + d.quotes.length > 0
}

export interface Counts {
  profiles: number
  clients: number
  catalog: number
  quotes: number
}
export const countsOf = (d: Pick<DataState, 'profiles' | 'clients' | 'catalog' | 'quotes'>): Counts => ({
  profiles: d.profiles.length,
  clients: d.clients.length,
  catalog: d.catalog.length,
  quotes: d.quotes.length,
})

/** Texto para a confirmação: "2 empresas, 14 clientes, 3 itens do catálogo e 32 orçamentos". */
export function describeCounts(c: Counts): string {
  const parts = [
    c.profiles && `${c.profiles} ${c.profiles === 1 ? 'empresa' : 'empresas'}`,
    c.clients && `${c.clients} ${c.clients === 1 ? 'cliente' : 'clientes'}`,
    c.catalog && `${c.catalog} ${c.catalog === 1 ? 'item do catálogo' : 'itens do catálogo'}`,
    c.quotes && `${c.quotes} ${c.quotes === 1 ? 'orçamento' : 'orçamentos'}`,
  ].filter(Boolean) as string[]
  if (parts.length < 2) return parts[0] ?? 'nenhum dado'
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`
}

const stamp = (x: { updatedAt?: string }) => (x.updatedAt ? Date.parse(x.updatedAt) || 0 : 0)

/** União por `id`: o registro com `updatedAt` mais recente fica; empate fica com o da nuvem. */
function unionById<T extends { id: string; updatedAt?: string }>(cloud: T[], local: T[]): T[] {
  const byId = new Map(cloud.map((x) => [x.id, x]))
  for (const item of local) {
    const prev = byId.get(item.id)
    if (!prev || stamp(item) > stamp(prev)) byId.set(item.id, item)
  }
  return [...byId.values()]
}

/** Unidades da nuvem mais as locais cujo símbolo ainda não existe lá (o orçamento guarda só o símbolo). */
function mergeUnits(cloud: Unit[], local: Unit[]): Unit[] {
  const known = new Set(cloud.map((u) => u.symbol.trim().toLowerCase()))
  const extra = local.filter((u) => !known.has(u.symbol.trim().toLowerCase()))
  return extra.length ? [...cloud, ...extra] : cloud
}

/**
 * Junta os dados locais aos da nuvem. Três regras para não gerar dado ruim:
 * - mesmo `id`: fica o mais recente (ver `unionById`);
 * - orçamento local cujo número já existe na mesma empresa (outro `id`): o servidor recusaria como `duplicado`;
 *   o número é refeito depois dos maiores da empresa, sem tocar nos da nuvem;
 * - `nextNumber` da empresa: o maior entre os dois lados, para a numeração nunca voltar atrás.
 * Unidades de medida: as da nuvem mais as locais de símbolo novo. A empresa ativa fica como na nuvem.
 */
export function mergeLocalIntoCloud(cloud: DataState, local: DataState): DataState {
  const profiles = unionById(cloud.profiles, local.profiles).map((p) => {
    const next = Math.max(
      p.nextNumber,
      local.profiles.find((x) => x.id === p.id)?.nextNumber ?? 1,
      cloud.profiles.find((x) => x.id === p.id)?.nextNumber ?? 1,
    )
    return next === p.nextNumber ? p : { ...p, nextNumber: next }
  })

  // Números ocupados por empresa. Cresce a cada orçamento renumerado, então dois renumerados nunca colidem.
  const taken = new Map<string, Set<string>>()
  const occupy = (profileId: string, number: string) => {
    if (!taken.has(profileId)) taken.set(profileId, new Set())
    taken.get(profileId)!.add(number)
  }
  for (const q of cloud.quotes) occupy(q.profileId, q.number)

  const freeNumber = (profileId: string) => {
    const prefix = profiles.find((p) => p.id === profileId)?.numberPrefix ?? ''
    const used = taken.get(profileId) ?? new Set<string>()
    let n = 0
    for (const num of used) {
      const rest = num.startsWith(prefix) ? num.slice(prefix.length) : ''
      if (/^\d+$/.test(rest)) n = Math.max(n, Number(rest))
    }
    return `${prefix}${String(n + 1).padStart(4, '0')}`
  }

  const cloudIds = new Set(cloud.quotes.map((q) => q.id))
  const incoming = local.quotes.map((q) => {
    // Mesmo id: é o mesmo orçamento (a união por `updatedAt` decide qual versão fica); não renumera
    if (cloudIds.has(q.id)) return q
    const clash = taken.get(q.profileId)?.has(q.number)
    const number = clash ? freeNumber(q.profileId) : q.number
    occupy(q.profileId, number)
    return number === q.number ? q : { ...q, number }
  })

  return {
    ...cloud,
    profiles,
    clients: unionById(cloud.clients, local.clients),
    catalog: unionById(cloud.catalog, local.catalog),
    quotes: unionById(cloud.quotes, incoming),
    units: mergeUnits(cloud.units, local.units),
  }
}

/** Dados vindos de um arquivo de backup, já na versão atual do formato. */
export function fromBackup(data: Partial<DataState>): DataState {
  return normalizeImport(data)
}

// "Agora não" no aviso do primeiro login: lembra neste navegador e nesta conta, para não perguntar a cada acesso.
const declinedKey = (userId: string) => `orcafacil:migracao-recusada:${userId}`

export function isMigrationDeclined(userId: string, storage: Pick<Storage, 'getItem'> = localStorage) {
  try {
    return storage.getItem(declinedKey(userId)) === '1'
  } catch {
    return false
  }
}

export function declineMigration(userId: string, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(declinedKey(userId), '1')
  } catch {
    /* sem armazenamento: pergunta de novo no próximo login */
  }
}
