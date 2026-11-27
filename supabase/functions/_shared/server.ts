// Utilitários das Edge Functions (Deno): resposta JSON com CORS, cliente admin e chamadas ao Mercado Pago.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { MP_API, type PlanPrice, type Preapproval, type SubscriptionPatch } from './mercadopago.ts'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

export type Admin = ReturnType<typeof admin>

/** Chamada à API do Mercado Pago com o token de acesso (secret `MP_ACCESS_TOKEN`). */
export async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(MP_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`Mercado Pago ${res.status} em ${path}: ${JSON.stringify(body)}`)
  return body as T
}

export const getPreapproval = (id: string) => mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`)

/** Busca o estado real da assinatura pelo `external_reference` do usuário e inclui o checkout pendente iniciado pelo app. */
export async function findLinkedPreapprovals(
  db: Admin,
  userId: string,
): Promise<{ ids: string[]; activeIds: string[] }> {
  const { data: row, error } = await db
    .from('subscriptions')
    .select('provider_subscription_id, pending_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const candidates = [
    ...new Set([row?.provider_subscription_id, row?.pending_subscription_id].filter((id): id is string => !!id)),
  ]
  const pres = await Promise.all(candidates.map((id) => getPreapproval(id)))
  const linked = pres.filter((p) => String(p.external_reference ?? '') === userId)
  return {
    ids: linked.filter((p) => ['pending', 'authorized', 'paused'].includes(p.status)).map((p) => p.id),
    activeIds: linked.filter((p) => p.status === 'authorized').map((p) => p.id),
  }
}

/** Localiza checkouts que o usuário já abriu, inclusive os que perderam o ID local ao fechar a aba antes de o app gravá-lo. */
export async function findUserPreapprovals(userId: string): Promise<Preapproval[]> {
  const result = await mp<{ results?: Preapproval[]; paging?: { total?: number } }>(
    `/preapproval/search?external_reference=${encodeURIComponent(userId)}`,
  )
  return (result.results ?? []).filter((p) => String(p.external_reference ?? '') === userId)
}

/**
 *
 * Cancela a assinatura no Mercado Pago (para de cobrar). A documentação mostra as duas grafias do status
 * ("cancelled" no SDK oficial, "canceled" no guia de gerenciamento), então tenta uma e cai para a outra.
 * Assinatura que já está cancelada conta como sucesso.
 */
export async function cancelPreapproval(id: string) {
  const existing = await getPreapproval(id).catch((e) => {
    const message = e instanceof Error ? e.message : String(e)
    // O Mercado Pago devolve 404 para uma preapproval já removida. Não há mais cobrança para cancelar.
    if (/Mercado Pago 404/.test(message)) return null
    throw e
  })
  if (!existing || ['cancelled', 'canceled'].includes(existing.status)) return

  let last: unknown
  for (const status of ['cancelled', 'canceled']) {
    try {
      await mp(`/preapproval/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status }) })
      return
    } catch (e) {
      last = e
    }
  }
  const pre = await getPreapproval(id).catch(() => null)
  if (pre && ['cancelled', 'canceled'].includes(pre.status)) return
  throw last
}

export interface CheckoutReservation {
  pending_subscription_id: string | null
  pending_amount: number
  pending_billing_interval: PlanPrice['billing_interval']
  checkout_token: string
  create_new: boolean
}

export async function finalizeCheckoutReservation(
  db: Admin,
  userId: string,
  reservation: CheckoutReservation,
  id: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('subscriptions')
    .update({ pending_subscription_id: id, pending_checkout_at: null })
    .eq('user_id', userId)
    .eq('pending_checkout_token', reservation.checkout_token)
    .select('user_id')
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function clearCheckoutReservation(
  db: Admin,
  userId: string,
  reservation: CheckoutReservation,
): Promise<void> {
  const { error } = await db
    .from('subscriptions')
    .update({
      pending_amount: null,
      pending_billing_interval: null,
      pending_checkout_at: null,
      pending_checkout_token: null,
    })
    .eq('user_id', userId)
    .eq('pending_checkout_token', reservation.checkout_token)
    .is('pending_subscription_id', null)
  if (error) throw error
}

export async function reserveCheckout(
  db: Admin,
  userId: string,
  interval: PlanPrice['billing_interval'],
): Promise<CheckoutReservation> {
  const { data, error } = await db.rpc('iniciar_checkout', { p_user: userId, p_interval: interval }).single()
  if (error) throw error
  return data as CheckoutReservation
}

/** Cria um preapproval de checkout com os dados validados no servidor. */
export async function createPreapproval(
  userId: string,
  email: string,
  price: PlanPrice,
): Promise<Preapproval & { init_point: string }> {
  return mp<Preapproval & { init_point: string }>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: `Orçafácil Pro (${price.billing_interval})`,
      external_reference: userId,
      // Só no staging. Em produção deve estar ausente, e o pagador é o e-mail verificado da conta.
      payer_email: Deno.env.get('MP_TEST_PAYER_EMAIL') || email,
      back_url: `${Deno.env.get('APP_URL')}/ajustes`,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      status: 'pending',
      auto_recurring: {
        frequency: price.months,
        frequency_type: 'months',
        transaction_amount: Number(price.amount),
        currency_id: 'BRL',
      },
    }),
  })
}

/**
 * Grava o plano do usuário. Upsert: contas criadas antes do gatilho de cadastro (handle_new_user) não têm linha em
 * subscriptions, e um update simples não alteraria nada sem dar erro.
 */
export async function saveSubscription(db: Admin, userId: string, patch: SubscriptionPatch) {
  const { error } = await db
    .from('subscriptions')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function getPrices(db: Admin): Promise<PlanPrice[]> {
  const { data, error } = await db.from('plan_prices').select('billing_interval, amount, months')
  if (error) throw error
  return (data ?? []) as PlanPrice[]
}
