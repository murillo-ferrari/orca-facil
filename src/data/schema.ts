import type { CatalogItem, Client, CompanyProfile, Quote, Unit } from '../types'
import { DEFAULT_UNITS, normalizeQuote } from '../store/factories'

/**
 * Dados do usuário, independentemente de onde ficam guardados (localStorage na edição Local,
 * Supabase + cópia local na edição Cloud). As telas só conhecem este formato.
 */
export interface DataState {
  profiles: CompanyProfile[]
  /** Empresa ativa: preferência do dispositivo (na Cloud, não é sincronizada) */
  activeProfileId: string | null
  clients: Client[]
  units: Unit[]
  catalog: CatalogItem[]
  quotes: Quote[]
}

export const DATA_KEYS = ['profiles', 'activeProfileId', 'clients', 'units', 'catalog', 'quotes'] as const

/**
 * Nome da chave no localStorage. **Fixo: nunca renomear** — renomear faria o app "perder" os dados de quem já usa.
 * O ":v1" é só parte do nome; a versão do formato é SCHEMA_VERSION.
 */
export const STORAGE_KEY = 'gerador-orcamento:v1'

/**
 * Versão do formato dos dados. Ao mudar o formato: incrementar, tratar a conversão em `migrateState`
 * (e em `normalizeQuote`, se for campo de orçamento) e cobrir com teste em schema.test.ts.
 *
 * Histórico:
 * - 1: formato inicial
 * - 2: `Quote.statusHistory` e `QuoteItem.catalogId`
 */
export const SCHEMA_VERSION = 2

/** Extrai só os dados (sem as ações do store) */
export function pickData(state: DataState): DataState {
  const { profiles, activeProfileId, clients, units, catalog, quotes } = state
  return { profiles, activeProfileId, clients, units, catalog, quotes }
}

/**
 * Converte dados salvos em qualquer versão anterior para a atual.
 * Roda para qualquer `fromVersion` diferente de SCHEMA_VERSION, inclusive dados sem versão (0).
 */
export function migrateState(persisted: unknown, _fromVersion: number): DataState {
  const state = (persisted ?? {}) as Partial<DataState>
  // v1 → v2: completa statusHistory e catalogId (normalizeQuote é idempotente)
  return {
    profiles: state.profiles ?? [],
    activeProfileId: state.activeProfileId ?? null,
    clients: state.clients ?? [],
    units: state.units ?? [],
    catalog: state.catalog ?? [],
    quotes: (state.quotes ?? []).map(normalizeQuote),
  }
}

/**
 * Prepara dados vindos de fora (arquivo de backup, importação na Cloud) para substituir o estado atual.
 * Diferente da migração, restaura as unidades padrão se vierem vazias e escolhe a primeira empresa como ativa.
 */
export function normalizeImport(data: Partial<DataState>): DataState {
  const migrated = migrateState(data, 0)
  return {
    ...migrated,
    activeProfileId: data.activeProfileId ?? migrated.profiles[0]?.id ?? null,
    units: migrated.units.length ? migrated.units : DEFAULT_UNITS,
  }
}
