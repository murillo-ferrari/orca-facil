import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  pickSubscription,
  subscriptionFromPreapproval,
  verifySignature,
  type PlanPrice,
  type Preapproval,
} from './mercadopago'

const PRICES: PlanPrice[] = [
  { billing_interval: 'mensal', amount: 9.99, months: 1 },
  { billing_interval: 'anual', amount: 99.99, months: 12 },
]
const USER = 'a0000000-0000-4000-8000-000000000001'
const pre = (p: Partial<Preapproval>): Preapproval => ({
  id: 'pre1',
  status: 'authorized',
  external_reference: USER,
  next_payment_date: '2026-12-24T10:00:00.000-03:00',
  auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 9.99, currency_id: 'BRL' },
  ...p,
})

describe('subscriptionFromPreapproval', () => {
  it('autorizada vira Pro ativo até a próxima cobrança', () => {
    expect(subscriptionFromPreapproval(pre({}), PRICES, null)).toEqual({
      userId: USER,
      patch: {
        plan: 'pro',
        status: 'active',
        billing_interval: 'mensal',
        provider: 'mercadopago',
        provider_subscription_id: 'pre1',
        current_period_end: '2026-12-24T13:00:00.000Z',
      },
    })
  })

  it('reconhece o anual (12 meses ou 1 ano)', () => {
    const r = { frequency: 12, frequency_type: 'months', transaction_amount: 99.99, currency_id: 'BRL' }
    expect(subscriptionFromPreapproval(pre({ auto_recurring: r }), PRICES, null)?.patch.billing_interval).toBe('anual')
    const y = { ...r, frequency: 1, frequency_type: 'years' }
    expect(subscriptionFromPreapproval(pre({ auto_recurring: y }), PRICES, null)?.patch.billing_interval).toBe('anual')
  })

  it('ativa sem próxima cobrança não fica sem fim', () => {
    const r = subscriptionFromPreapproval(pre({ next_payment_date: null }), PRICES, null, Date.UTC(2026, 10, 24))
    expect(r?.patch.current_period_end).toBe('2026-12-24T00:00:00.000Z')
  })

  it('ignora pendente, usuário inválido, valor ou moeda fora da tabela', () => {
    expect(subscriptionFromPreapproval(pre({ status: 'pending' }), PRICES, null)).toBeNull()
    expect(subscriptionFromPreapproval(pre({ external_reference: 'x' }), PRICES, null)).toBeNull()
    const cheap = { frequency: 1, frequency_type: 'months', transaction_amount: 0.01, currency_id: 'BRL' }
    expect(subscriptionFromPreapproval(pre({ auto_recurring: cheap }), PRICES, null)).toBeNull()
    const usd = { frequency: 1, frequency_type: 'months', transaction_amount: 9.99, currency_id: 'USD' }
    expect(subscriptionFromPreapproval(pre({ auto_recurring: usd }), PRICES, null)).toBeNull()
  })

  it('cancelada ou pausada só altera a assinatura em vigor', () => {
    const c = pre({ status: 'cancelled', next_payment_date: null })
    expect(subscriptionFromPreapproval(c, PRICES, 'outra')).toBeNull()
    const r = subscriptionFromPreapproval(c, PRICES, 'pre1')
    expect(r?.patch.status).toBe('canceled')
    expect(r?.patch).not.toHaveProperty('current_period_end')
    expect(subscriptionFromPreapproval(pre({ status: 'paused' }), PRICES, 'pre1')?.patch.status).toBe('past_due')
  })
})

describe('pickSubscription', () => {
  it('prefere a autorizada; sem ela, reflete o estado da que já estava gravada', () => {
    const old = pre({ id: 'velha', status: 'cancelled', next_payment_date: null })
    const novaAtiva = pre({ id: 'nova' })
    expect(pickSubscription([old, novaAtiva], PRICES, USER, 'velha')?.patch.provider_subscription_id).toBe('nova')
    expect(pickSubscription([old], PRICES, USER, 'velha')?.patch.status).toBe('canceled')
  })

  it('ignora pendentes, assinaturas de outro usuário e canceladas que não são a atual', () => {
    expect(pickSubscription([pre({ status: 'pending' })], PRICES, USER, null)).toBeUndefined()
    expect(pickSubscription([pre({})], PRICES, 'a0000000-0000-4000-8000-000000000002', null)).toBeUndefined()
    expect(pickSubscription([pre({ id: 'x', status: 'cancelled' })], PRICES, USER, 'outra')).toBeUndefined()
  })
})

describe('verifySignature', () => {
  const secret = 'segredo'
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex')

  it('aceita a assinatura do Mercado Pago (data.id alfanumérico em minúsculas)', async () => {
    const v1 = sign('id:abc123;request-id:req-1;ts:1704908010;')
    expect(await verifySignature(secret, `ts=1704908010,v1=${v1}`, 'req-1', 'ABC123')).toBe(true)
  })

  it('omite pares sem valor', async () => {
    const v1 = sign('id:999;ts:1704908010;')
    expect(await verifySignature(secret, `ts=1704908010, v1=${v1}`, null, '999')).toBe(true)
  })

  it('recusa assinatura errada, ausente ou malformada', async () => {
    const v1 = sign('id:999;request-id:req-1;ts:1704908010;')
    expect(await verifySignature(secret, `ts=1704908010,v1=${v1}`, 'req-2', '999')).toBe(false)
    expect(await verifySignature('outro', `ts=1704908010,v1=${v1}`, 'req-1', '999')).toBe(false)
    expect(await verifySignature(secret, null, 'req-1', '999')).toBe(false)
    expect(await verifySignature(secret, `v1=${v1}`, 'req-1', '999')).toBe(false)
  })
})
