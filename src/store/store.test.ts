// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store'
import { clientToQuoteClient, newClient, newItem, newProfile } from './factories'
import type { CompanyProfile } from '../types'

const empty = {
  profiles: [],
  activeProfileId: null,
  clients: [],
  catalog: [],
  quotes: [],
}

function addProfile(patch: Partial<CompanyProfile> = {}) {
  const p = { ...newProfile(), label: 'Empresa', tradeName: 'Empresa', ...patch }
  useStore.getState().saveProfile(p)
  return p
}

const quote = (id: string) => useStore.getState().quotes.find((q) => q.id === id)!

beforeEach(() => {
  localStorage.clear()
  useStore.setState(empty)
})

describe('perfis de empresa', () => {
  it('o primeiro perfil salvo vira o ativo', () => {
    const p = addProfile()
    expect(useStore.getState().activeProfileId).toBe(p.id)
    addProfile({ label: 'Outra' })
    expect(useStore.getState().activeProfileId).toBe(p.id)
  })

  it('excluir o perfil ativo ativa o próximo', () => {
    const a = addProfile()
    const b = addProfile()
    useStore.getState().deleteProfile(a.id)
    expect(useStore.getState().activeProfileId).toBe(b.id)
    useStore.getState().deleteProfile(b.id)
    expect(useStore.getState().activeProfileId).toBeNull()
  })
})

describe('createQuote', () => {
  it('numera por empresa com prefixo e 4 dígitos, e avança o próximo número', () => {
    const p = addProfile({ numberPrefix: 'ORC-', nextNumber: 41 })
    const id1 = useStore.getState().createQuote(p.id)!
    const id2 = useStore.getState().createQuote(p.id)!
    expect(quote(id1).number).toBe('ORC-0041')
    expect(quote(id2).number).toBe('ORC-0042')
    expect(useStore.getState().profiles[0].nextNumber).toBe(43)
  })

  it('aplica os padrões da empresa e começa como rascunho com histórico', () => {
    const p = addProfile({ defaultValidityDays: 30, defaultPaymentTerms: 'PIX', defaultNotes: 'Garantia 90 dias' })
    const q = quote(useStore.getState().createQuote(p.id)!)
    expect(q.status).toBe('rascunho')
    expect(q.statusHistory.map((h) => h.status)).toEqual(['rascunho'])
    expect(q.paymentTerms).toBe('PIX')
    expect(q.notes).toBe('Garantia 90 dias')
    const days = (Date.parse(q.validUntil) - Date.parse(q.issueDate)) / 86_400_000
    expect(days).toBe(30)
  })

  it('pode já vir com o cliente preenchido (cópia, não referência)', () => {
    const p = addProfile()
    const c = { ...newClient(), name: 'Maria' }
    const qc = clientToQuoteClient(c)
    const q = quote(useStore.getState().createQuote(p.id, qc)!)
    expect(q.client.name).toBe('Maria')
    expect(q.client.clientId).toBe(c.id)
    expect(q.client).not.toBe(qc)
  })

  it('retorna null para empresa inexistente', () => {
    expect(useStore.getState().createQuote('nao-existe')).toBeNull()
  })
})

describe('updateQuote e histórico de status', () => {
  it('registra cada mudança de status, e só quando muda', () => {
    const p = addProfile()
    const id = useStore.getState().createQuote(p.id)!
    const { updateQuote } = useStore.getState()
    updateQuote(id, { title: 'Pintura' })
    updateQuote(id, { status: 'enviado' })
    updateQuote(id, { status: 'enviado' })
    updateQuote(id, { status: 'aprovado' })
    const q = quote(id)
    expect(q.title).toBe('Pintura')
    expect(q.statusHistory.map((h) => h.status)).toEqual(['rascunho', 'enviado', 'aprovado'])
    expect(q.statusHistory.every((h) => !Number.isNaN(Date.parse(h.at)))).toBe(true)
  })
})

describe('duplicateQuote', () => {
  it('gera novo número, volta para rascunho, reinicia o histórico e troca os ids dos itens', () => {
    const p = addProfile()
    const id = useStore.getState().createQuote(p.id)!
    const item = newItem({ catalogId: 'cat-1', description: 'Pintura', unitPrice: 30 })
    useStore.getState().updateQuote(id, { items: [item], status: 'aprovado' })

    const copyId = useStore.getState().duplicateQuote(id)!
    const copy = quote(copyId)
    expect(copy.number).toBe('ORC-0002')
    expect(copy.status).toBe('rascunho')
    expect(copy.statusHistory.map((h) => h.status)).toEqual(['rascunho'])
    expect(copy.items[0].id).not.toBe(item.id)
    expect(copy.items[0].catalogId).toBe('cat-1')
    expect(quote(id).status).toBe('aprovado') // original intacto
  })
})

describe('importData (backup)', () => {
  it('completa campos de versões antigas e restaura unidades padrão se vierem vazias', () => {
    const p = newProfile()
    useStore.getState().importData({
      profiles: [p],
      units: [],
      quotes: [
        {
          id: 'q1',
          profileId: p.id,
          items: [{ id: 'i1', description: 'X', details: '', unit: 'un', quantity: 1, unitPrice: 1 }],
        } as never,
      ],
    })
    const s = useStore.getState()
    expect(s.activeProfileId).toBe(p.id)
    expect(s.units.length).toBeGreaterThan(0)
    expect(s.quotes[0].statusHistory).toEqual([])
    expect(s.quotes[0].items[0].catalogId).toBeNull()
    expect(s.quotes[0].extras).toEqual([])
  })
})

describe('persistência no localStorage', () => {
  it('grava na chave gerador-orcamento:v1 com a versão atual do formato', () => {
    addProfile()
    const saved = JSON.parse(localStorage.getItem('gerador-orcamento:v1')!)
    expect(saved.version).toBe(2)
    expect(saved.state.profiles).toHaveLength(1)
    expect(saved.state.addProfile).toBeUndefined() // só dados, nada de funções
  })

  it('migra dados salvos no formato v1 ao carregar', async () => {
    const v1 = {
      version: 1,
      state: {
        ...empty,
        units: [],
        quotes: [
          {
            id: 'q1',
            profileId: 'p',
            number: 'ORC-0001',
            status: 'enviado',
            items: [{ id: 'i', description: 'Serviço', details: '', unit: 'un', quantity: 1, unitPrice: 100 }],
          },
        ],
      },
    }
    localStorage.setItem('gerador-orcamento:v1', JSON.stringify(v1))
    vi.resetModules()
    const { useStore: fresh } = await import('./store')
    await fresh.persist.rehydrate()
    const q = fresh.getState().quotes[0]
    expect(q.statusHistory).toEqual([])
    expect(q.items[0].catalogId).toBeNull()
    expect(JSON.parse(localStorage.getItem('gerador-orcamento:v1')!).version).toBe(2)
  })
})
