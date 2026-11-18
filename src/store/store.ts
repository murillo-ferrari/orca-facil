import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CatalogItem, Client, CompanyProfile, Quote, Unit } from '../types'
import { DEFAULT_UNITS, formatQuoteNumber, newQuote, nowISO, uid } from './factories'

export interface DataState {
  profiles: CompanyProfile[]
  activeProfileId: string | null
  clients: Client[]
  units: Unit[]
  catalog: CatalogItem[]
  quotes: Quote[]
}

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

  createQuote: (profileId: string) => string | null
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
  persist(
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

      createQuote: (profileId) => {
        const s = get()
        const taken = takeNumber(s.profiles, profileId)
        if (!taken) return null
        const [number, profiles] = taken
        const profile = profiles.find((p) => p.id === profileId)!
        const quote = newQuote(profile, number)
        set({ profiles, quotes: [quote, ...s.quotes] })
        return quote.id
      },
      updateQuote: (id, patch) =>
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...patch, updatedAt: nowISO() } : q)),
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
          createdAt: now,
          updatedAt: now,
        }
        copy.items = copy.items.map((it) => ({ ...it, id: uid() }))
        copy.extras = copy.extras.map((e) => ({ ...e, id: uid() }))
        set({ profiles, quotes: [copy, ...s.quotes] })
        return copy.id
      },

      importData: (data) =>
        set(() => ({
          profiles: data.profiles ?? [],
          activeProfileId: data.activeProfileId ?? data.profiles?.[0]?.id ?? null,
          clients: data.clients ?? [],
          units: data.units?.length ? data.units : DEFAULT_UNITS,
          catalog: data.catalog ?? [],
          quotes: data.quotes ?? [],
        })),
    }),
    {
      name: 'gerador-orcamento:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export const useActiveProfile = () =>
  useStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? null)

export function exportSnapshot(): DataState {
  const { profiles, activeProfileId, clients, units, catalog, quotes } = useStore.getState()
  return { profiles, activeProfileId, clients, units, catalog, quotes }
}
