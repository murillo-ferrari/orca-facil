// Regras puras da cobrança no Mercado Pago (sem Deno nem rede): testadas pelo Vitest em mercadopago.test.ts.

export const MP_API = 'https://api.mercadopago.com'

export interface PlanPrice {
  billing_interval: 'mensal' | 'anual'
  amount: number
  months: number
}

/** O que interessa de uma assinatura (GET /preapproval/{id}). */
export interface Preapproval {
  id: string
  status: string
  external_reference?: string | number | null
  next_payment_date?: string | null
  auto_recurring?: { frequency?: number; frequency_type?: string; transaction_amount?: number; currency_id?: string }
}

/** Alterações em `subscriptions`; campos ausentes ficam como estão. */
export interface SubscriptionPatch {
  plan: 'pro'
  status: 'active' | 'past_due' | 'canceled'
  billing_interval: PlanPrice['billing_interval']
  /** Valor contratado nesta assinatura; pode diferir do preço atual após reajuste. */
  provider_amount: number
  billing_interval_contracted: PlanPrice['billing_interval']
  provider: 'mercadopago'
  provider_subscription_id: string
  current_period_end?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Converte a assinatura do Mercado Pago na linha de `subscriptions` do usuário (`external_reference` = user_id).
 * Retorna null quando não há nada a gravar: assinatura pendente (checkout não concluído), de outro usuário/formato,
 * ou com valor/periodicidade que não batem com a tabela de preços (só o servidor cria assinaturas, então isso não
 * deveria acontecer; se acontecer, não vira Pro).
 * `current` = id da assinatura já gravada: uma assinatura antiga que muda de status não derruba a atual.
 */
export function subscriptionFromPreapproval(
  pre: Preapproval,
  prices: PlanPrice[],
  current: string | null,
  now = Date.now(),
  contractedAmount?: number | null,
  contractedInterval?: PlanPrice['billing_interval'] | null,
): { userId: string; patch: SubscriptionPatch } | null {
  const userId = String(pre.external_reference ?? '')
  if (!UUID.test(userId)) return null

  // `authorized` pode ser a assinatura recém-aprovada ou uma renovação. Se já era a atual, mantém o status que o
  // servidor conhece; uma cobrança renovada, sozinha, não desfaz um cancelamento nem uma pausa.
  const status =
    pre.status === 'authorized' && current === pre.id
      ? 'active'
      : ({ authorized: 'active', paused: 'past_due', cancelled: 'canceled', canceled: 'canceled' }[pre.status] ?? null)
  if (!status) return null // pending e desconhecidos
  if (status !== 'active' && current !== pre.id) return null

  const r = pre.auto_recurring ?? {}
  const months =
    r.frequency_type === 'months' ? (r.frequency ?? 0) : r.frequency_type === 'years' ? (r.frequency ?? 0) * 12 : 0
  const interval = months === 1 ? 'mensal' : months === 12 ? 'anual' : null
  const recurringAmount = Number(r.transaction_amount)
  if (!interval || !Number.isFinite(recurringAmount) || recurringAmount <= 0 || r.currency_id !== 'BRL') return null
  if (contractedInterval != null && contractedInterval !== interval) return null
  // Assinatura já contratada (renovação, cancelamento): vale o valor acordado, mesmo depois de um reajuste.
  if (contractedAmount != null && Number(contractedAmount) !== recurringAmount) return null
  // Sem contrato gravado: só vira Pro com o preço vigente da tabela.
  if (contractedAmount == null && !prices.some((p) => p.months === months && Number(p.amount) === recurringAmount)) {
    return null
  }

  const patch: SubscriptionPatch = {
    plan: 'pro',
    status: status as SubscriptionPatch['status'],
    billing_interval: interval,
    billing_interval_contracted: interval,
    provider_amount: recurringAmount,
    provider: 'mercadopago',
    provider_subscription_id: pre.id,
  }
  // Fim do período = próxima cobrança. Cancelada pode vir sem ela: mantém o fim já gravado. Ativa sem data nunca
  // fica sem fim (null = Pro para sempre em private.current_plan): usa hoje + o período do preço.
  if (pre.next_payment_date) {
    patch.current_period_end = new Date(pre.next_payment_date).toISOString()
    return { userId, patch }
  }
  if (status !== 'active') return { userId, patch }

  const end = new Date(now)
  end.setUTCMonth(end.getUTCMonth() + months)
  patch.current_period_end = end.toISOString()
  return { userId, patch }
}

/**
 * Confere o cabeçalho `x-signature` (`ts=...,v1=...`): HMAC-SHA256, com a chave secreta do webhook, de
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (pares sem valor são omitidos), como o validador do SDK
 * oficial (`WebhookSignatureValidator`). `data.id` vem da query string; alfanumérico vai em minúsculas.
 */
export async function verifySignature(
  secret: string,
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
  now = Date.now(),
): Promise<boolean> {
  // Configuração ausente não pode virar uma chave HMAC vazia aceita por engano.
  if (!secret || !xSignature) return false
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()]
    }),
  )
  if (!/^\d+$/.test(parts.ts ?? '') || !parts.v1) return false
  // Recusa replays: o Mercado Pago envia `ts` em segundos; tolerância pequena a atraso e diferença do relógio.
  if (Math.abs(now - Number(parts.ts) * 1000) > 5 * 60 * 1000) return false

  const id = dataId?.trim() && /[a-z]/i.test(dataId) ? dataId.trim().toLowerCase() : dataId?.trim()
  const manifest =
    (id ? `id:${id};` : '') + (xRequestId?.trim() ? `request-id:${xRequestId.trim()};` : '') + `ts:${parts.ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')

  // Comparação em tempo constante
  const v1 = String(parts.v1).toLowerCase()
  if (v1.length !== hex.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

/**
 * Entre as assinaturas do usuário no Mercado Pago (busca por `external_reference`), escolhe a que vale para o plano:
 * uma autorizada (a mais recente do resultado vence se houver duas) ou, na falta, a que já estava gravada
 * (`current`), para refletir pausa, atraso ou cancelamento feitos fora do app. null = nada a gravar.
 */
/** Dados que o servidor gravou na linha de `subscriptions`: só esses IDs podem ser ativados ou reconciliados. */
export interface LinkedSubscription {
  currentId: string | null
  currentAmount: number | null
  currentInterval: PlanPrice['billing_interval'] | null
  pendingId: string | null
  pendingAmount: number | null
  pendingInterval: PlanPrice['billing_interval'] | null
}

/**
 * Ativa o checkout pendente (se autorizado) ou reconcilia a assinatura atual. Nunca promove uma assinatura que o
 * servidor não vinculou à conta, mesmo que tenha o mesmo external_reference.
 */
export function pickSubscription(
  found: Preapproval[],
  prices: PlanPrice[],
  userId: string,
  linked: LinkedSubscription,
  now = Date.now(),
) {
  const own = found.filter((p) => String(p.external_reference ?? '') === userId)
  const pending = own.find((p) => p.id === linked.pendingId && p.status === 'authorized')
  if (pending) {
    return subscriptionFromPreapproval(
      pending,
      prices,
      linked.currentId,
      now,
      linked.pendingAmount,
      linked.pendingInterval,
    )
  }
  const current = own.find((p) => p.id === linked.currentId)
  if (!current) return null
  return subscriptionFromPreapproval(
    current,
    prices,
    linked.currentId,
    now,
    linked.currentAmount,
    linked.currentInterval,
  )
}
