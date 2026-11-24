import { describe, expect, it } from 'vitest'
import {
  ITEM,
  autoResolvable,
  buildMerged,
  compareRecords,
  planResolution,
  sideBySide,
  titleOf,
  toLines,
} from './conflicts'
import type { ConflictRecord } from './engine'

describe('compareRecords (mescla em três vias)', () => {
  const base = { id: '1', name: 'Ana', phone: '111', notes: 'a' }

  it('o que só você mudou fica sem perguntar; o que só a nuvem mudou já está no app', () => {
    const local = { ...base, name: 'Ana Maria' }
    const server = { ...base, phone: '222' }
    const cmp = compareRecords(base, local, server)
    expect(cmp.conflicts).toEqual([])
    expect(cmp.auto).toEqual(['name'])
    // O app já tem a versão da nuvem; a mescla leva junto a sua mudança
    expect(buildMerged(server, local, cmp, {}, server)).toEqual({ ...base, name: 'Ana Maria', phone: '222' })
  })

  it('o mesmo campo mudado nos dois lados é conflito e a escolha decide', () => {
    const local = { ...base, name: 'Ana A' }
    const server = { ...base, name: 'Ana B' }
    const cmp = compareRecords(base, local, server)
    expect(cmp.conflicts).toEqual([{ key: 'name', label: 'Nome', local: 'Ana A', server: 'Ana B' }])
    expect(buildMerged(server, local, cmp, { name: 'local' }, server).name).toBe('Ana A')
    expect(buildMerged(server, local, cmp, { name: 'server' }, server).name).toBe('Ana B')
  })

  it('sem versão-base, toda diferença é conflito', () => {
    const cmp = compareRecords(null, { id: '1', name: 'A', phone: '1' }, { id: '1', name: 'B', phone: '1' })
    expect(cmp.conflicts.map((c) => c.key)).toEqual(['name'])
  })

  it('campos técnicos (datas de atualização, nextNumber) nunca geram conflito', () => {
    const cmp = compareRecords(
      null,
      { id: '1', updatedAt: 'x', nextNumber: 3 },
      { id: '1', updatedAt: 'y', nextNumber: 9 },
    )
    expect(cmp).toEqual({ conflicts: [], auto: [] })
  })

  it('o histórico de status acompanha o status escolhido', () => {
    const b = { id: '1', status: 'rascunho', statusHistory: [{ status: 'rascunho', at: 'a' }] }
    const local = { ...b, status: 'enviado', statusHistory: [...b.statusHistory, { status: 'enviado', at: 'b' }] }
    const server = { ...b, status: 'aprovado', statusHistory: [...b.statusHistory, { status: 'aprovado', at: 'c' }] }
    const cmp = compareRecords(b, local, server)
    expect(cmp.conflicts.map((c) => c.key)).toEqual(['status'])
    const merged = buildMerged(server, local, cmp, { status: 'local' }, server)
    expect(merged.status).toBe('enviado')
    expect(merged.statusHistory).toEqual(local.statusHistory)
  })

  it('alteração em campo aninhado compara o objeto inteiro, sem depender da ordem das chaves', () => {
    const a = { id: '1', address: { city: 'SP', street: 'X' } }
    const b = { id: '1', address: { street: 'X', city: 'SP' } }
    expect(compareRecords(null, a, b).conflicts).toEqual([])
  })
})

describe('toLines', () => {
  it('vazio vira lista vazia', () => {
    expect([toLines(''), toLines(null), toLines(undefined), toLines({})]).toEqual([[], [], [], []])
  })

  it('texto com várias linhas, números e datas', () => {
    expect(toLines('a\nb')).toEqual(['a', 'b'])
    expect(toLines(3)).toEqual(['3'])
    expect(toLines('2026-11-23')).toEqual(['23/11/2026'])
  })

  it('lista de itens: rótulos em português, sem ids, sem campos vazios', () => {
    const items = [
      { id: 'x', catalogId: null, description: 'Pintura', details: '', unit: 'm²', quantity: 2, unitPrice: 100 },
      { id: 'y', catalogId: 'c', description: 'Massa', details: '', unit: 'un', quantity: 1, unitPrice: 5 },
    ]
    expect(toLines(items, 'items')).toEqual([
      '1.',
      '  Descrição: Pintura',
      '  Unidade: m²',
      '  Quantidade: 2',
      '  Preço unitário: 100',
      '2.',
      '  Descrição: Massa',
      '  Unidade: un',
      '  Quantidade: 1',
      '  Preço unitário: 5',
    ])
  })

  it('o rótulo depende do pai (descrição do acréscimo × nome curto da empresa)', () => {
    expect(toLines([{ id: 'e', label: 'Taxa', value: 10 }], 'extras')).toEqual([
      '1.',
      '  Descrição: Taxa',
      '  Valor: 10',
    ])
    expect(toLines({ label: 'Loja' })).toEqual(['Nome curto: Loja'])
  })

  it('objeto aninhado e booleano', () => {
    expect(toLines({ city: 'SP', street: '' }, 'address')).toEqual(['Cidade: SP'])
    expect(toLines({ showBankInfo: true })).toEqual(['Mostrar dados bancários: Sim'])
  })
})

describe('sideBySide', () => {
  it('textos iguais não têm linhas marcadas', () => {
    const { left, right } = sideBySide(['a', 'b'], ['a', 'b'])
    expect([...left, ...right].every((l) => l.kind === 'same')).toBe(true)
  })

  it('linha trocada: vermelho à esquerda, verde à direita, só a palavra que mudou em destaque', () => {
    const { left, right } = sideBySide(['Nome: Ana B'], ['Nome: Ana A'])
    expect(left).toHaveLength(1)
    expect(left[0].kind).toBe('del')
    expect(left[0].segs.filter((s) => s.hl).map((s) => s.text)).toEqual(['B'])
    expect(right[0].kind).toBe('add')
    expect(right[0].segs.filter((s) => s.hl).map((s) => s.text)).toEqual(['A'])
  })

  it('linha só de um lado: removida (esquerda) ou adicionada (direita), com a outra coluna vazia', () => {
    const r1 = sideBySide(['a', 'b'], ['a'])
    expect(r1.left.map((l) => l.kind)).toEqual(['same', 'del'])
    expect(r1.right.map((l) => l.kind)).toEqual(['same'])
    const r2 = sideBySide([], ['x'])
    expect(r2.left).toEqual([])
    expect(r2.right).toMatchObject([{ kind: 'add' }])
  })
})

describe('titleOf', () => {
  it('orçamento mostra número e cliente; cai em nomes padrão sem dados', () => {
    expect(titleOf('quotes', { number: 'ORC-0001', client: { name: 'Ana' } })).toBe('ORC-0001 · Ana')
    expect(titleOf('clients', {})).toBe('Cliente')
    expect(titleOf('company_profiles', { tradeName: 'Loja' })).toBe('Loja')
    expect(titleOf('quotes', null)).toBe('Item excluído')
  })
})

describe('planResolution e autoResolvable', () => {
  const base = { id: '1', name: 'Ana', phone: '111' }
  const conflict = (patch: Partial<ConflictRecord>): ConflictRecord => ({
    table: 'clients',
    id: '1',
    at: '2026-11-24T10:00:00.000Z',
    local: base,
    server: base,
    base,
    serverRev: 2,
    ...patch,
  })

  it('campos diferentes nos dois lados: resolve sozinho, levando a sua mudança sobre a versão da nuvem', () => {
    const c = conflict({ local: { ...base, name: 'Ana A' }, server: { ...base, phone: '222' } })
    expect(autoResolvable(c)).toBe(true)
    const plan = planResolution(c, c.server as never, {})
    expect(plan.apply?.upserts[0].data).toEqual({ id: '1', name: 'Ana A', phone: '222' })
    expect(plan.revive).toBe(false)
  })

  it('mesmo campo nos dois lados: precisa de decisão e cada escolha leva ao resultado certo', () => {
    const c = conflict({ local: { ...base, name: 'Ana A' }, server: { ...base, name: 'Ana B' } })
    expect(autoResolvable(c)).toBe(false)
    const mine = planResolution(c, c.server as never, { name: 'local' })
    const theirs = planResolution(c, c.server as never, { name: 'server' })
    expect(mine.apply?.upserts[0]?.data).toMatchObject({ name: 'Ana A' })
    expect(theirs.apply?.upserts[0]?.data).toMatchObject({ name: 'Ana B' })
  })

  it('você excluiu, a nuvem editou: excluir mesmo assim apaga no app; manter a da nuvem não faz nada', () => {
    const c = conflict({ local: null, server: { ...base, name: 'Ana B' } })
    expect(autoResolvable(c)).toBe(false)
    expect(planResolution(c, c.server as never, { [ITEM]: 'local' }).apply).toEqual({ upserts: [], deletedIds: ['1'] })
    expect(planResolution(c, c.server as never, { [ITEM]: 'server' }).apply).toBeNull()
  })

  it('a nuvem excluiu, você editou: manter o seu recria o item e pede ao motor para reviver', () => {
    const c = conflict({ local: { ...base, name: 'Ana A' }, server: null })
    const keep = planResolution(c, null, { [ITEM]: 'local' })
    expect(keep.apply?.upserts[0].data).toEqual({ ...base, name: 'Ana A' })
    expect(keep.revive).toBe(true)
    expect(planResolution(c, null, { [ITEM]: 'server' })).toEqual({ apply: null, revive: false })
  })

  it('registro de versão antiga (sem server) não é resolvido sozinho e não altera nada', () => {
    const c = conflict({ server: undefined, base: undefined })
    expect(autoResolvable(c)).toBe(false)
  })
})
