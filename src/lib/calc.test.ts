import { describe, expect, it } from 'vitest'
import { itemTotal, quoteTotals, round2 } from './calc'

const items = (...pairs: [number, number][]) => pairs.map(([quantity, unitPrice]) => ({ quantity, unitPrice }))
const noDiscount = { type: 'percent' as const, value: 0 }

describe('round2', () => {
  it('arredonda para centavos sem erro de ponto flutuante', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('itemTotal', () => {
  it('multiplica quantidade por preço', () => expect(itemTotal({ quantity: 42.5, unitPrice: 28.9 })).toBe(1228.25))
  it('trata campos vazios como zero', () => expect(itemTotal({ quantity: Number.NaN, unitPrice: 10 })).toBe(0))
})

describe('quoteTotals', () => {
  it('soma itens e acréscimos', () => {
    const t = quoteTotals({
      items: items([42.5, 30], [6, 1250], [8, 85]) as never,
      discount: noDiscount,
      extras: [{ id: 'e', label: 'Deslocamento', value: 120 }],
    })
    expect(t).toEqual({ subtotal: 9455, discountValue: 0, extrasTotal: 120, total: 9575 })
  })

  it('aplica desconto percentual sobre o subtotal (antes dos acréscimos)', () => {
    const t = quoteTotals({
      items: items([1, 9455]) as never,
      discount: { type: 'percent', value: 5 },
      extras: [{ id: 'e', label: '', value: 120 }],
    })
    expect(t.discountValue).toBe(472.75)
    expect(t.total).toBe(9102.25)
  })

  it('limita o desconto percentual entre 0% e 100%', () => {
    const base = { items: items([1, 100]) as never, extras: [] }
    expect(quoteTotals({ ...base, discount: { type: 'percent', value: 150 } }).discountValue).toBe(100)
    expect(quoteTotals({ ...base, discount: { type: 'percent', value: -10 } }).discountValue).toBe(0)
  })

  it('desconto em valor maior que o subtotal não deixa o total negativo', () => {
    const t = quoteTotals({ items: items([1, 100]) as never, discount: { type: 'value', value: 500 }, extras: [] })
    expect(t.total).toBe(0)
  })

  it('ignora desconto em valor negativo', () => {
    const t = quoteTotals({ items: items([1, 100]) as never, discount: { type: 'value', value: -50 }, extras: [] })
    expect(t.total).toBe(100)
  })
})
