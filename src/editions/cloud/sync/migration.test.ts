// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, type DataState } from '../../../data/schema'
import { useStore } from '../../../store/store'
import {
  countsOf,
  declineMigration,
  describeCounts,
  fromBackup,
  hasContent,
  isMigrationDeclined,
  mergeLocalIntoCloud,
  readLocalEdition,
} from './migration'

const empty = (): DataState => ({
  profiles: [],
  activeProfileId: null,
  clients: [],
  units: [],
  catalog: [],
  quotes: [],
})
const profile = (id: string, nextNumber = 1, numberPrefix = 'ORC-') => ({ id, nextNumber, numberPrefix })
const quote = (id: string, profileId: string, number: string, updatedAt = '2026-11-01T10:00:00.000Z') => ({
  id,
  profileId,
  number,
  updatedAt,
  items: [],
})
const state = (patch: object = {}) => ({ ...empty(), ...patch }) as DataState

describe('readLocalEdition', () => {
  const store = (value: string | null) => ({ getItem: () => value })

  it('lê o formato do persist do zustand e migra para a versão atual', () => {
    const saved = JSON.stringify({
      version: 1,
      state: { profiles: [profile('p')], quotes: [quote('q', 'p', 'ORC-0001')] },
    })
    const data = readLocalEdition(store(saved))!
    expect(data.profiles).toHaveLength(1)
    expect(data.quotes[0]).toMatchObject({ id: 'q', statusHistory: [], extras: [] }) // migração v1 → v2
  })

  it('sem dados, só com unidades padrão, com JSON inválido ou com armazenamento bloqueado: nada a migrar', () => {
    expect(readLocalEdition(store(null))).toBeNull()
    expect(readLocalEdition(store(JSON.stringify({ version: 2, state: { units: [{ id: 'u' }] } })))).toBeNull()
    expect(readLocalEdition(store('{não é json'))).toBeNull()
    expect(readLocalEdition(store(JSON.stringify({ sem: 'state' })))).toBeNull()
    expect(
      readLocalEdition({
        getItem: () => {
          throw new Error('bloqueado')
        },
      }),
    ).toBeNull()
  })

  it('usa a chave fixa do localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state: { clients: [{ id: 'c' }] } }))
    expect(readLocalEdition()?.clients).toHaveLength(1)
    localStorage.removeItem(STORAGE_KEY)
  })
})

describe('readLocalEdition com o que a edição Local realmente grava', () => {
  it('lê o que o store (persist do zustand) escreve no localStorage', () => {
    localStorage.removeItem(STORAGE_KEY)
    const id = 'p-real'
    useStore.getState().saveProfile({ ...profile(id), label: 'Loja', tradeName: 'Loja' } as never)
    useStore.getState().saveClient({ id: 'c-real', name: 'Ana' } as never)

    const data = readLocalEdition()
    expect(data?.profiles.map((p) => p.id)).toEqual([id])
    expect(data?.clients.map((c) => c.id)).toEqual(['c-real'])
    localStorage.removeItem(STORAGE_KEY)
  })
})

describe('contagens', () => {
  it('describeCounts fala no singular e no plural e ignora o que é zero', () => {
    expect(describeCounts({ profiles: 1, clients: 14, catalog: 0, quotes: 32 })).toBe(
      '1 empresa, 14 clientes e 32 orçamentos',
    )
    expect(describeCounts({ profiles: 0, clients: 1, catalog: 0, quotes: 0 })).toBe('1 cliente')
    expect(describeCounts({ profiles: 2, clients: 0, catalog: 3, quotes: 0 })).toBe('2 empresas e 3 serviços')
    expect(describeCounts({ profiles: 0, clients: 0, catalog: 0, quotes: 0 })).toBe('nenhum dado')
  })

  it('hasContent e countsOf', () => {
    expect(hasContent(empty())).toBe(false)
    expect(hasContent(state({ clients: [{ id: 'c' }] }))).toBe(true)
    expect(countsOf(state({ quotes: [{ id: 'q' }, { id: 'r' }] }))).toEqual({
      profiles: 0,
      clients: 0,
      catalog: 0,
      quotes: 2,
    })
  })
})

describe('mergeLocalIntoCloud', () => {
  it('conta vazia na nuvem: leva tudo do local', () => {
    const local = state({ profiles: [profile('p', 5)], quotes: [quote('q', 'p', 'ORC-0004')] })
    const r = mergeLocalIntoCloud(state(), local)
    expect(r.profiles).toHaveLength(1)
    expect(r.quotes.map((q) => q.number)).toEqual(['ORC-0004'])
    expect(r.profiles[0].nextNumber).toBe(5)
  })

  it('mesmo id: fica o mais recente; empate fica com o da nuvem', () => {
    const cloud = state({ clients: [{ id: 'c', name: 'Nuvem', updatedAt: '2026-11-02T00:00:00.000Z' }] })
    const newer = state({ clients: [{ id: 'c', name: 'Local novo', updatedAt: '2026-11-03T00:00:00.000Z' }] })
    const older = state({ clients: [{ id: 'c', name: 'Local velho', updatedAt: '2026-11-01T00:00:00.000Z' }] })
    const tie = state({ clients: [{ id: 'c', name: 'Local igual', updatedAt: '2026-11-02T00:00:00.000Z' }] })
    expect(mergeLocalIntoCloud(cloud, newer).clients[0]).toMatchObject({ name: 'Local novo' })
    expect(mergeLocalIntoCloud(cloud, older).clients[0]).toMatchObject({ name: 'Nuvem' })
    expect(mergeLocalIntoCloud(cloud, tie).clients[0]).toMatchObject({ name: 'Nuvem' })
  })

  it('registros diferentes dos dois lados são somados', () => {
    const cloud = state({ clients: [{ id: 'a' }], catalog: [{ id: 'x' }] })
    const local = state({ clients: [{ id: 'b' }], catalog: [{ id: 'y' }] })
    const r = mergeLocalIntoCloud(cloud, local)
    expect(r.clients.map((c) => c.id).sort()).toEqual(['a', 'b'])
    expect(r.catalog.map((c) => c.id).sort()).toEqual(['x', 'y'])
  })

  it('orçamento local com número já usado por outro orçamento da nuvem recebe número novo, sem tocar nos da nuvem', () => {
    const cloud = state({
      profiles: [profile('p', 4)],
      quotes: [quote('n1', 'p', 'ORC-0001'), quote('n3', 'p', 'ORC-0003')],
    })
    const local = state({
      profiles: [profile('p', 3)],
      quotes: [quote('l1', 'p', 'ORC-0001'), quote('l2', 'p', 'ORC-0002'), quote('l3', 'p', 'ORC-0003')],
    })
    const r = mergeLocalIntoCloud(cloud, local)
    const byId = Object.fromEntries(r.quotes.map((q) => [q.id, q.number]))
    expect(byId.n1).toBe('ORC-0001')
    expect(byId.n3).toBe('ORC-0003')
    expect(byId.l2).toBe('ORC-0002') // sem choque: mantém
    // os dois que colidiam recebem números novos, diferentes entre si e de todos os outros
    expect(new Set([byId.l1, byId.l3]).size).toBe(2)
    expect(new Set(Object.values(byId)).size).toBe(5)
    expect(byId.l1).toMatch(/^ORC-000[4-9]$/)
  })

  it('o mesmo orçamento nos dois lados (mesmo id) não é renumerado', () => {
    const cloud = state({ profiles: [profile('p')], quotes: [quote('q', 'p', 'ORC-0001', '2026-11-01T00:00:00.000Z')] })
    const local = state({ profiles: [profile('p')], quotes: [quote('q', 'p', 'ORC-0001', '2026-11-05T00:00:00.000Z')] })
    const r = mergeLocalIntoCloud(cloud, local)
    expect(r.quotes).toHaveLength(1)
    expect(r.quotes[0]).toMatchObject({ number: 'ORC-0001', updatedAt: '2026-11-05T00:00:00.000Z' })
  })

  it('o próximo número da empresa é o maior entre os dois lados', () => {
    const r = mergeLocalIntoCloud(state({ profiles: [profile('p', 10)] }), state({ profiles: [profile('p', 40)] }))
    expect(r.profiles[0].nextNumber).toBe(40)
    const r2 = mergeLocalIntoCloud(state({ profiles: [profile('p', 50)] }), state({ profiles: [profile('p', 40)] }))
    expect(r2.profiles[0].nextNumber).toBe(50)
  })

  it('unidades: as da nuvem ficam e as locais de símbolo novo são acrescentadas, sem duplicar', () => {
    const cloud = state({ units: [{ id: 'u', symbol: 'un', name: 'Unidade' }] })
    const local = state({
      units: [
        { id: 'v', symbol: 'UN', name: 'Unidade (local)' },
        { id: 'w', symbol: 'sc', name: 'Saco' },
      ],
    })
    expect(mergeLocalIntoCloud(cloud, local).units.map((u) => u.symbol)).toEqual(['un', 'sc'])
  })

  it('a empresa ativa fica como na nuvem e os dados de entrada não são alterados', () => {
    const cloud = state({ activeProfileId: 'a' })
    const local = state({ activeProfileId: 'b', clients: [{ id: 'c' }] })
    const before = JSON.stringify(cloud)
    expect(mergeLocalIntoCloud(cloud, local).activeProfileId).toBe('a')
    expect(JSON.stringify(cloud)).toBe(before)
  })
})

describe('fromBackup', () => {
  it('migra e restaura as unidades padrão como a importação de backup da edição Local', () => {
    const r = fromBackup({ profiles: [profile('p') as never], quotes: [] })
    expect(r.units.length).toBeGreaterThan(0)
    expect(r.activeProfileId).toBe('p')
  })
})

describe('recusa do aviso', () => {
  it('lembra por conta e não afeta outra conta no mesmo navegador', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    }
    expect(isMigrationDeclined('ana', storage)).toBe(false)
    declineMigration('ana', storage)
    expect(isMigrationDeclined('ana', storage)).toBe(true)
    expect(isMigrationDeclined('bia', storage)).toBe(false)
  })

  it('armazenamento bloqueado não quebra: pergunta de novo', () => {
    const blocked = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(isMigrationDeclined('ana', blocked)).toBe(false)
    expect(() => declineMigration('ana', blocked)).not.toThrow()
  })
})
