import type { Quote, QuoteItem } from '../types'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const itemTotal = (item: Pick<QuoteItem, 'quantity' | 'unitPrice'>) =>
  round2((item.quantity || 0) * (item.unitPrice || 0))

export function quoteTotals(q: Pick<Quote, 'items' | 'discount' | 'extras'>) {
  const subtotal = round2(q.items.reduce((acc, it) => acc + itemTotal(it), 0))
  const extrasTotal = round2(q.extras.reduce((acc, e) => acc + (e.value || 0), 0))
  const discountValue = round2(
    q.discount.type === 'percent'
      ? (subtotal * Math.min(Math.max(q.discount.value || 0, 0), 100)) / 100
      : Math.max(q.discount.value || 0, 0),
  )
  const total = round2(Math.max(subtotal - discountValue + extrasTotal, 0))
  return { subtotal, discountValue, extrasTotal, total }
}
