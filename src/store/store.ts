import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CatalogItem, Client, CompanyProfile, Quote, QuoteClient, Unit } from '../types'
import { DEFAULT_UNITS, formatQuoteNumber, newQuote, nowISO, uid } from './factories'
import { STORAGE_KEY, SCHEMA_VERSION, migrateState, normalizeImport, pickData, type DataState } from '../data/schema'
import { persistence } from '../editions'

export type { DataState }

interface Actions {
  saveProfile: (p: CompanyProfile) => void
  deleteProfile: (id: string) => void
  setActiveProfile: (id: string) => void

  saveClient: (c: Client) => void
  deleteClient: (id: string) => void

  saveUnit: (u: Unit) => void
  deleteUnit: (id: string) => void
  resetUnits: () => void

  saveCatalogItem: (c: CatalogItem) => void
  deleteCatalogItem: (id: string) => void

  /** Cria um orçamento (opcionalmente já com o cliente preenchido) e retorna o id */
  createQuote: (profileId: string, client?: QuoteClient) => string | null
  updateQuote: (id: string, patch: Partial<Quote>) => void
  deleteQuote: (id: string) => void
  duplicateQuote: (id: string) => string | null

  importData: (data: Partial<DataState>) => void
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...list, item]
  const copy = [...list]
  copy[idx] = item
  return copy
}

/** Reserva o próximo número de orçamento do perfil e retorna [número, perfis atualizados] */
function takeNumber(profiles: CompanyProfile[], profileId: string): [string, CompanyProfile[]] | null {
  const profile = profiles.find((p) => p.id === profileId)
  if (!profile) return null
  const number = formatQuoteNumber(profile.numberPrefix, profile.nextNumber)
  const updated = profiles.map((p) => (p.id === profileId ? { ...p, nextNumber: p.nextNumber + 1 } : p))
  return [number, updated]
}

export const useStore = create<DataState & Actions>()(
  // Genéricos explícitos: o estado tem ações, mas só os dados (DataState) são persistidos
  persist<DataState & Actions, [], [], DataState>(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      clients: [],
      units: DEFAULT_UNITS,
      catalog: [],
      quotes: [],

      saveProfile: (p) =>
        set((s) => ({
          profiles: upsert(s.profiles, { ...p, updatedAt: nowISO() }),
          activeProfileId: s.activeProfileId ?? p.id,
        })),
      deleteProfile: (id) =>
        set((s) => {
          const profiles = s.profiles.filter((p) => p.id !== id)
          return {
            profiles,
            activeProfileId: s.activeProfileId === id ? (profiles[0]?.id ?? null) : s.activeProfileId,
          }
        }),
      setActiveProfile: (id) => set({ activeProfileId: id }),

      saveClient: (c) => set((s) => ({ clients: upsert(s.clients, { ...c, updatedAt: nowISO() }) })),
      deleteClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),

      saveUnit: (u) => set((s) => ({ units: upsert(s.units, u) })),
      deleteUnit: (id) => set((s) => ({ units: s.units.filter((u) => u.id !== id) })),
      resetUnits: () => set({ units: DEFAULT_UNITS.map((u) => ({ ...u, id: uid() })) }),

      saveCatalogItem: (c) => set((s) => ({ catalog: upsert(s.catalog, { ...c, updatedAt: nowISO() }) })),
      deleteCatalogItem: (id) => set((s) => ({ catalog: s.catalog.filter((c) => c.id !== id) })),

      createQuote: (profileId, client) => {
        const s = get()
        const taken = takeNumber(s.profiles, profileId)
        if (!taken) return null
        const [number, profiles] = taken
        const profile = profiles.find((p) => p.id === profileId)!
        const quote = newQuote(profile, number)
        if (client) quote.client = structuredClone(client)
        set({ profiles, quotes: [quote, ...s.quotes] })
        return quote.id
      },
      updateQuote: (id, patch) =>
        set((s) => ({
          quotes: s.quotes.map((q) => {
            if (q.id !== id) return q
            const now = nowISO()
            const next = { ...q, ...patch, updatedAt: now }
            // Registra quando o status muda (base dos relatórios por data de aprovação/envio)
            if (patch.status && patch.status !== q.status) {
              next.statusHistory = [...(q.statusHistory ?? []), { status: patch.status, at: now }]
            }
            return next
          }),
        })),
      deleteQuote: (id) => set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),
      duplicateQuote: (id) => {
        const s = get()
        const original = s.quotes.find((q) => q.id === id)
        if (!original) return null
        const taken = takeNumber(s.profiles, original.profileId)
        if (!taken) return null
        const [number, profiles] = taken
        const now = nowISO()
        const copy: Quote = {
          ...structuredClone(original),
          id: uid(),
          number,
          status: 'rascunho',
          statusHistory: [{ status: 'rascunho', at: now }],
          createdAt: now,
          updatedAt: now,
        }
        copy.items = copy.items.map((it) => ({ ...it, id: uid() }))
        copy.extras = copy.extras.map((e) => ({ ...e, id: uid() }))
        set({ profiles, quotes: [copy, ...s.quotes] })
        return copy.id
      },

      importData: (data) => set(() => normalizeImport(data)),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      // Onde os dados ficam depende da edição (src/editions); as ações acima não mudam
      storage: persistence.storage,
      partialize: pickData,
      migrate: (persisted, fromVersion) => migrateState(persisted, fromVersion) as DataState & Actions,
    },
  ),
)

export const useActiveProfile = () =>
  useStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? null)

export const exportSnapshot = (): DataState => pickData(useStore.getState())
