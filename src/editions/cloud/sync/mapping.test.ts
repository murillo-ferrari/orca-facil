import { describe, expect, it } from 'vitest'
import type { DataState } from '../../../data/schema'
import { applyRemote, maxUsedNumber, renumberQuotes, toTables } from './mapping'

const state = (patch: object = {}) =>
  ({ profiles: [], activeProfileId: null, clients: [], units: [], catalog: [], quotes: [], ...patch }) as DataState
const profile = (id: string, nextNumber: number) => ({ id, numberPrefix: 'ORC-', nextNumber, tradeName: id })
const quote = (id: string, profileId: string, number: string) => ({ id, profileId, number })
const up = (...rows: { id: string }[]) => ({ upserts: rows.map((r) => ({ id: r.id, data: r })), deletedIds: [] })

describe('toTables', () => {
  it('leva as unidades numa linha com o id do usuário e não inclui a empresa ativa', () => {
    const s = state({ units: [{ id: 'u', symbol: 'un', name: 'Unidade' }], activeProfileId: 'x' })
    const t = toTables(s, 'user-1')
    expect(t.user_settings).toEqual([{ id: 'user-1', units: s.units }])
    expect(JSON.stringify(t)).not.toContain('activeProfileId')
  })
})

describe('applyRemote', () => {
  it('insere, substitui no mesmo lugar e remove', () => {
    const s = state({
      clients: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    })
    const r = applyRemote(s, 'clients', {
      upserts: [
        { id: 'a', data: { id: 'a', name: 'A2' } },
        { id: 'c', data: { id: 'c', name: 'C' } },
      ],
      deletedIds: ['b'],
    })
    expect(r.clients).toEqual([
      { id: 'a', name: 'A2' },
      { id: 'c', name: 'C' },
    ])
  })

  it('a numeração local da empresa não segue o contador do servidor (que aponta para outro bloco)', () => {
    const s = state({ profiles: [profile('p', 3)], activeProfileId: 'p' })
    expect(applyRemote(s, 'company_profiles', up(profile('p', 40))).profiles?.[0].nextNumber).toBe(3)
    expect(applyRemote(s, 'company_profiles', up(profile('p', 1))).profiles?.[0].nextNumber).toBe(3)
  })

  it('empresa nova vinda do servidor mantém o número do servidor e vira a ativa se não havia nenhuma', () => {
    const r = applyRemote(state(), 'company_profiles', up(profile('p', 7)))
    expect(r.profiles?.[0].nextNumber).toBe(7)
    expect(r.activeProfileId).toBe('p')
  })

  it('empresa ativa excluída em outro dispositivo passa para a primeira que sobrou', () => {
    const s = state({ profiles: [profile('a', 1), profile('b', 1)], activeProfileId: 'a' })
    const r = applyRemote(s, 'company_profiles', { upserts: [], deletedIds: ['a'] })
    expect(r.activeProfileId).toBe('b')
  })

  it('unidades: usa as do servidor; linha sem unidades (conta nova) não mexe nas locais', () => {
    expect(applyRemote(state(), 'user_settings', up({ id: 'u', units: [] } as { id: string })).units).toEqual([])
    expect(applyRemote(state(), 'user_settings', up({ id: 'u' })).units).toBeUndefined()
  })
})

describe('numeração', () => {
  it('orçamento vindo do servidor não mexe no próximo número (ele é governado pelo bloco reservado)', () => {
    const s = state({ profiles: [profile('p', 1)], activeProfileId: 'p' })
    const r = applyRemote(s, 'quotes', up(quote('a', 'p', 'ORC-0007')))
    expect(r.profiles).toBeUndefined()
  })

  it('maxUsedNumber lê só números no formato da empresa', () => {
    const p = profile('p', 1) as never
    const qs = [
      quote('a', 'p', 'ORC-0007'),
      quote('b', 'p', 'ORC-0003'),
      quote('c', 'p', 'XYZ-0099'),
      quote('d', 'p', 'ORC-x'),
    ]
    expect(maxUsedNumber(p, qs as never)).toBe(7)
    expect(maxUsedNumber(p, [])).toBe(0)
  })

  it('renumera os recusados com os próximos números, depois dos já existentes', () => {
    const s = state({
      profiles: [profile('p', 2)],
      quotes: [quote('q1', 'p', 'ORC-0001'), quote('q2', 'p', 'ORC-0002'), quote('q3', 'p', 'ORC-0001')],
    })
    const r = renumberQuotes(s, ['q1', 'q3'])!
    // q2 (ORC-0002) é o maior número fora dos recusados: os recusados seguem a partir do 3
    expect(r.quotes?.map((q) => q.number)).toEqual(['ORC-0003', 'ORC-0002', 'ORC-0004'])
    expect(r.profiles?.[0].nextNumber).toBe(5)
    expect(s.profiles[0].nextNumber).toBe(2) // não altera o estado de entrada
  })

  it('devolve null quando não há o que renumerar', () => {
    expect(renumberQuotes(state({ profiles: [profile('p', 1)] }), ['x'])).toBeNull()
  })
})
