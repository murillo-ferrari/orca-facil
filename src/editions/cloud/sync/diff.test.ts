import { describe, expect, it } from 'vitest'
import { diffAgainstKnown, fingerprint, type Known } from './diff'

const item = (id: string, nome: string) => ({ id, nome })

describe('fingerprint', () => {
  it('ignora a ordem das chaves', () => {
    expect(fingerprint({ a: 1, b: { x: 1, y: 2 } })).toBe(fingerprint({ b: { y: 2, x: 1 }, a: 1 }))
  })
})

describe('diffAgainstKnown', () => {
  it('não gera nada quando nada mudou', () => {
    const atual = [item('1', 'Ana')]
    const conhecido = new Map<string, Known>([['1', { rev: 1, data: fingerprint(atual[0]) }]])
    expect(diffAgainstKnown(atual, conhecido)).toEqual([])
  })

  it('registro novo entra com baseRev 0', () => {
    const [change] = diffAgainstKnown([item('1', 'Ana')], new Map())
    expect(change).toMatchObject({ id: '1', baseRev: 0, deleted: false })
  })

  it('registro alterado usa a rev conhecida como base', () => {
    const atual = [item('1', 'Ana Maria')]
    const conhecido = new Map<string, Known>([['1', { rev: 3, data: fingerprint(item('1', 'Ana')) }]])
    expect(diffAgainstKnown(atual, conhecido)).toEqual([{ id: '1', baseRev: 3, deleted: false, data: atual[0] }])
  })

  it('registro que sumiu vira exclusão com a rev conhecida', () => {
    const conhecido = new Map<string, Known>([['1', { rev: 2, data: '{}' }]])
    expect(diffAgainstKnown([], conhecido)).toEqual([{ id: '1', baseRev: 2, deleted: true, data: null }])
  })
})
