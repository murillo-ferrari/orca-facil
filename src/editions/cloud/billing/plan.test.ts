import { describe, expect, it } from 'vitest'
import { planView, type Subscription } from './plan'

const NOW = Date.parse('2026-11-24T12:00:00Z')
const fmt = (iso: string) => iso.slice(0, 10)
const sub = (s: Partial<Subscription>): Subscription => ({
  plan: 'pro',
  status: 'active',
  billing_interval: 'mensal',
  current_period_end: '2026-12-24T12:00:00Z',
  ...s,
})

describe('planView', () => {
  it('grátis sem assinatura ou com plano free', () => {
    expect(planView(null, NOW, fmt)).toMatchObject({ pro: false, title: 'Grátis', canCancel: false })
    expect(planView(sub({ plan: 'free' }), NOW, fmt).pro).toBe(false)
  })

  it('Pro ativo mostra a renovação', () => {
    expect(planView(sub({}), NOW, fmt)).toEqual({
      pro: true,
      title: 'Pro mensal',
      detail: 'Renova em 2026-12-24.',
      canCancel: true,
    })
  })

  it('cancelado vale até o fim do período e não pode cancelar de novo', () => {
    expect(planView(sub({ status: 'canceled' }), NOW, fmt)).toMatchObject({
      pro: true,
      detail: 'Cancelado: vale até 2026-12-24.',
      canCancel: false,
    })
  })

  it('atrasado avisa durante a tolerância de 7 dias e depois volta ao grátis', () => {
    const late = sub({ current_period_end: '2026-11-20T12:00:00Z' })
    expect(planView(late, NOW, fmt)).toMatchObject({ pro: true, detail: expect.stringContaining('pendente') })
    expect(planView(sub({ current_period_end: '2026-11-10T12:00:00Z' }), NOW, fmt).pro).toBe(false)
  })
})
