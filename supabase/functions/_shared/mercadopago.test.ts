import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  pickSubscription,
  subscriptionFromPreapproval,
  verifySignature,
  type LinkedSubscription,
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
        billing_interval_contracted: 'mensal',
        provider_amount: 9.99,
        provider: 'mercadopago',
        provider_subscription_id: 'pre1',
        current_period_end: '2026-12-24T13:00:00.000Z',
      },
    })
  })

  it('continua reconhecendo o preço contratado depois de um reajuste, mas não ativa um checkout novo com preço antigo', () => {
    const newPrices = [{ billing_interval: 'mensal' as const, amount: 12.99, months: 1 }]
    expect(subscriptionFromPreapproval(pre({}), newPrices, 'pre1', Date.now(), 9.99)?.patch).toMatchObject({
      plan: 'pro',
      provider_amount: 9.99,
      billing_interval: 'mensal',
    })
    expect(subscriptionFromPreapproval(pre({}), newPrices, null)).toBeNull()
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
  const linked = (l: Partial<LinkedSubscription>): LinkedSubscription => ({
    currentId: null,
    currentAmount: null,
    currentInterval: null,
    pendingId: null,
    pendingAmount: null,
    pendingInterval: null,
    ...l,
  })

  it('ativa o checkout pendente autorizado; sem ele, reflete o estado da assinatura atual', () => {
    const old = pre({ id: 'velha', status: 'cancelled', next_payment_date: null })
    const nova = pre({ id: 'nova' })
    const l = linked({ currentId: 'velha', currentAmount: 9.99, pendingId: 'nova', pendingAmount: 9.99 })
    expect(pickSubscription([old, nova], PRICES, USER, l)?.patch.provider_subscription_id).toBe('nova')
    const s = linked({ currentId: 'velha', currentAmount: 9.99, currentInterval: 'mensal' })
    expect(pickSubscription([old], PRICES, USER, s)?.patch.status).toBe('canceled')
  })

  it('só ativa a ID de checkout vinculada pelo servidor, e só para o dono', () => {
    const l = linked({ pendingId: 'pre1', pendingAmount: 9.99, pendingInterval: 'mensal' })
    expect(pickSubscription([pre({ status: 'pending' })], PRICES, USER, l)).toBeNull()
    expect(pickSubscription([pre({})], PRICES, 'a0000000-0000-4000-8000-000000000002', l)).toBeNull()
    expect(pickSubscription([pre({})], PRICES, USER, linked({ pendingId: 'outra', pendingAmount: 9.99 }))).toBeNull()
  })

  it('não ativa checkout cujo valor ou período não batem com o reservado', () => {
    const l = linked({ pendingId: 'pre1', pendingAmount: 99.99, pendingInterval: 'anual' })
    expect(pickSubscription([pre({})], PRICES, USER, l)).toBeNull()
  })
})

describe('verifySignature', () => {
  const secret = 'segredo'
  const now = Date.UTC(2026, 10, 26, 12)
  const ts = Math.floor(now / 1000)
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex')

  it('aceita a assinatura do Mercado Pago (data.id alfanumérico em minúsculas)', async () => {
    const v1 = sign(`id:abc123;request-id:req-1;ts:${ts};`)
    expect(await verifySignature(secret, `ts=${ts},v1=${v1}`, 'req-1', 'ABC123', now)).toBe(true)
  })

  it('omite pares sem valor', async () => {
    const v1 = sign(`id:999;ts:${ts};`)
    expect(await verifySignature(secret, `ts=${ts}, v1=${v1}`, null, '999', now)).toBe(true)
  })

  it('recusa assinatura errada, ausente ou malformada', async () => {
    const v1 = sign(`id:999;request-id:req-1;ts:${ts};`)
    expect(await verifySignature(secret, `ts=${ts},v1=${v1}`, 'req-2', '999', now)).toBe(false)
    expect(await verifySignature('outro', `ts=${ts},v1=${v1}`, 'req-1', '999', now)).toBe(false)
    expect(await verifySignature(secret, null, 'req-1', '999', now)).toBe(false)
    expect(await verifySignature(secret, `v1=${v1}`, 'req-1', '999', now)).toBe(false)
    expect(await verifySignature('', `ts=${ts},v1=${v1}`, 'req-1', '999', now)).toBe(false)
    expect(await verifySignature(secret, `ts=${ts - 301},v1=${v1}`, 'req-1', '999', now)).toBe(false)
    expect(await verifySignature('', `ts=${ts},v1=${v1}`, 'req-1', '999', now)).toBe(false)
    expect(await verifySignature(secret, `ts=${ts + 301},v1=${v1}`, 'req-1', '999', now)).toBe(false)
  })
})
