// Webhook do Mercado Pago (Edge Function, Deno). URL cadastrada no painel do Mercado Pago:
//   https://<ref>.supabase.co/functions/v1/mercadopago-webhook  (tópicos de Assinaturas)
//
// 1. Confere o cabeçalho x-signature (secret `MP_WEBHOOK_SECRET`); inválido → 401.
// 2. Registra o evento em billing_events. O id da notificação é único por (provider, event_id): repetições
//    reaproveitam a linha e não são processadas de novo depois de concluídas.
// 3. Não confia no corpo: busca a assinatura na API e grava o estado dela em subscriptions. Reprocessar é inofensivo.
// Falha no passo 3 → 500, e o Mercado Pago tenta de novo.
import { subscriptionFromPreapproval, verifySignature } from '../_shared/mercadopago.ts'
import { admin, getPreapproval, getPrices, mp, reply, saveSubscription } from '../_shared/server.ts'

// Assinatura criada/alterada → o id é da assinatura. Cobrança recorrente → buscar a assinatura dela.
async function preapprovalIdOf(type: string, dataId: string): Promise<string | null> {
  if (type === 'subscription_preapproval') return dataId
  if (type !== 'subscription_authorized_payment') return null
  const pay = await mp<{ preapproval_id?: string }>(`/authorized_payments/${encodeURIComponent(dataId)}`)
  return pay.preapproval_id ?? null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  const url = new URL(req.url)
  const raw = await req.text()
  const event = (() => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  // A assinatura usa o data.id da query string (documentação do Mercado Pago); o corpo é só reserva
  const dataId = url.searchParams.get('data.id') ?? event?.data?.id?.toString() ?? null
  const ok = await verifySignature(
    Deno.env.get('MP_WEBHOOK_SECRET') ?? '',
    req.headers.get('x-signature'),
    req.headers.get('x-request-id'),
    dataId,
  )
  if (!ok || !event || !dataId) return reply(401, { error: 'assinatura_invalida' })

  const type = String(event.type ?? url.searchParams.get('type') ?? '')
  const eventId = String(event.id ?? `${type}:${dataId}:${req.headers.get('x-request-id')}`)
  const db = admin()

  const { data: row, error: insertError } = await db
    .from('billing_events')
    .upsert({ provider: 'mercadopago', event_id: eventId, payload: event }, { onConflict: 'provider,event_id' })
    .select('id, processed_at')
    .single()
  if (insertError) {
    console.error('webhook: billing_events', insertError.message)
    return reply(500, { error: 'falha_ao_registrar' })
  }
  if (row.processed_at) return reply(200, { ok: true, repetido: true })

  try {
    const preapprovalId = await preapprovalIdOf(type, dataId)
    if (preapprovalId) {
      const pre = await getPreapproval(preapprovalId)
      const userId = String(pre.external_reference ?? '')
      const { data: sub } = await db
        .from('subscriptions')
        .select('provider_subscription_id')
        .eq('user_id', userId)
        .maybeSingle()
      const change = subscriptionFromPreapproval(pre, await getPrices(db), sub?.provider_subscription_id ?? null)
      if (change) await saveSubscription(db, change.userId, change.patch)
    }

    await db.from('billing_events').update({ processed_at: new Date().toISOString() }).eq('id', row.id)
    return reply(200, { ok: true })
  } catch (e) {
    console.error('webhook', eventId, e instanceof Error ? e.message : e)
    return reply(500, { error: 'falha_ao_processar' })
  }
})
