import { describe, expect, it } from 'vitest'
import {
  DATA_KEYS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  migrateState,
  normalizeImport,
  pickData,
  type DataState,
} from './schema'
import { newProfile } from '../store/factories'

const v1Quote = {
  id: 'q1',
  profileId: 'p',
  number: 'ORC-0001',
  status: 'enviado',
  items: [{ id: 'i', description: 'Serviço', details: '', unit: 'un', quantity: 1, unitPrice: 100 }],
}

describe('constantes do formato', () => {
  it('a chave do localStorage não muda (renomear perderia os dados dos usuários)', () => {
    expect(STORAGE_KEY).toBe('gerador-orcamento:v1')
  })
  it('versão atual do formato', () => expect(SCHEMA_VERSION).toBe(2))
})

describe('migrateState', () => {
  it('v1 → v2: completa statusHistory, catalogId e extras', () => {
    const s = migrateState({ quotes: [v1Quote] }, 1)
    expect(s.quotes[0].statusHistory).toEqual([])
    expect(s.quotes[0].items[0].catalogId).toBeNull()
    expect(s.quotes[0].extras).toEqual([])
  })
  it('dados sem versão ou vazios viram um estado válido', () => {
    expect(migrateState(undefined, 0)).toEqual({
      profiles: [],
      activeProfileId: null,
      clients: [],
      units: [],
      catalog: [],
      quotes: [],
    })
  })
  it('não apaga dados já no formato atual (é idempotente)', () => {
    const once = migrateState({ quotes: [v1Quote] }, 1)
    expect(migrateState(once, 2)).toEqual(once)
  })
  it('mantém unidades vazias (o usuário pode ter apagado todas)', () => {
    expect(migrateState({ units: [] }, 1).units).toEqual([])
  })
})

describe('normalizeImport', () => {
  it('restaura unidades padrão e escolhe a primeira empresa como ativa', () => {
    const p = newProfile()
    const s = normalizeImport({ profiles: [p], quotes: [] })
    expect(s.units.length).toBeGreaterThan(0)
    expect(s.activeProfileId).toBe(p.id)
  })
  it('respeita a empresa ativa do backup', () => {
    const [a, b] = [newProfile(), newProfile()]
    expect(normalizeImport({ profiles: [a, b], activeProfileId: b.id, quotes: [] }).activeProfileId).toBe(b.id)
  })
})

describe('pickData', () => {
  it('copia só os campos de dados', () => {
    const withActions = { ...migrateState({}, 0), saveProfile: () => {} } as DataState & { saveProfile: () => void }
    expect(Object.keys(pickData(withActions)).sort()).toEqual([...DATA_KEYS].sort())
  })
})

describe('aparência do PDF (Pro)', () => {
  it('sobrevive à migração e à importação; dados antigos (sem branding) continuam válidos', () => {
    const withBrand = { ...newProfile(), branding: { logo: 'data:image/png;base64,AAAA', accent: '#1d4ed8' } }
    const { branding: _old, ...legacy } = newProfile()
    const out = normalizeImport({ profiles: [withBrand, legacy as never], quotes: [] })
    expect(out.profiles[0].branding).toEqual({ logo: 'data:image/png;base64,AAAA', accent: '#1d4ed8' })
    expect(out.profiles[1].branding).toBeUndefined()
  })
})
