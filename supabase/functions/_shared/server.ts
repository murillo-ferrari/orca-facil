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

/**
 * Cancela a assinatura no Mercado Pago (para de cobrar). A documentação mostra as duas grafias do status
 * ("cancelled" no SDK oficial, "canceled" no guia de gerenciamento), então tenta uma e cai para a outra.
 * Assinatura que já está cancelada conta como sucesso.
 */
export async function cancelPreapproval(id: string) {
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
