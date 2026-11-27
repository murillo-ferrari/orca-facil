// Assinatura do plano Pro pelo Mercado Pago (Edge Function, Deno). Ver docs/plano-versao-cloud.md, seção 9.3.
//
// POST { acao: 'assinar', periodo: 'mensal' | 'anual' } → { url } do checkout do Mercado Pago
// POST { acao: 'confirmar' } → { pro } depois de consultar o Mercado Pago (não espera o webhook)
// POST { acao: 'cancelar' } → cancela no Mercado Pago; o Pro vale até o fim do período já pago
//
// O valor cobrado vem da tabela plan_prices, nunca do app. O plano muda pelo webhook ou aqui (confirmar/cancelar),
// sempre a partir do estado lido na API do Mercado Pago e com a chave de serviço.
import { subscriptionFromPreapproval } from '../_shared/mercadopago.ts'
import {
  admin,
  cancelPreapproval,
  clearCheckoutReservation,
  cors,
  createPreapproval,
  findLinkedPreapprovals,
  finalizeCheckoutReservation,
  getPreapproval,
  getPrices,
  reply,
  reserveCheckout,
  saveSubscription,
} from '../_shared/server.ts'

type Interval = 'mensal' | 'anual'
const asInterval = (v: string | null | undefined) => (v === 'mensal' || v === 'anual' ? (v as Interval) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!jwt) return reply(401, { error: 'unauthorized' })
  const db = admin()
  const { data: auth, error: authError } = await db.auth.getUser(jwt)
  if (authError || !auth.user?.email) return reply(401, { error: 'unauthorized' })
  const user = auth.user

  const body = await req.json().catch(() => ({}))
  const { data: sub } = await db.from('subscriptions').select('*').eq('user_id', user.id).single()

  try {
    if (body.acao === 'assinar') {
      const prices = await getPrices(db)
      const requestedPrice = prices.find((p) => p.billing_interval === body.periodo)
      if (!requestedPrice) return reply(400, { error: 'periodo_invalido' })
      if (
        sub?.plan === 'pro' &&
        sub.current_period_end &&
        Date.parse(sub.current_period_end) + 7 * 86400000 > Date.now()
      ) {
        return reply(409, { error: 'ja_assinante' })
      }
      const reservation = await reserveCheckout(db, user.id, requestedPrice.billing_interval)
      if (!reservation.create_new) {
        if (reservation.pending_subscription_id) {
          const pending = await getPreapproval(reservation.pending_subscription_id)
          if (String(pending.external_reference ?? '') === user.id) return reply(200, { url: pending.init_point })
        }
        return reply(409, { error: 'checkout_em_andamento' })
      }
      const price = prices.find((p) => p.billing_interval === reservation.pending_billing_interval)
      if (!price || Number(price.amount) !== Number(reservation.pending_amount)) {
        return reply(409, { error: 'preco_alterado' })
      }
      try {
        const pre = await createPreapproval(user.id, user.email, price)
        const linked = await finalizeCheckoutReservation(db, user.id, reservation, pre.id)
        if (!linked) {
          await cancelPreapproval(pre.id)
          return reply(409, { error: 'checkout_substituido' })
        }
        return reply(200, { url: pre.init_point })
      } catch (e) {
        await clearCheckoutReservation(db, user.id, reservation)
        throw e
      }
    }

    // Só confirma a ID que o próprio app guardou como pendente ou ativa. O id vindo do browser (preapproval_id)
    // nunca basta para promover: ele é cruzado com a coluna do servidor e com external_reference.
    if (body.acao === 'confirmar') {
      const callbackId = typeof body.preapproval_id === 'string' ? body.preapproval_id : null
      const pendingId = sub?.pending_subscription_id
      const currentId = sub?.provider_subscription_id
      const isPending = !!callbackId && callbackId === pendingId
      const id = isPending ? callbackId : currentId
      if (!id) return reply(200, { pro: false })
      const pre = await getPreapproval(id)
      if (String(pre.external_reference ?? '') !== user.id) return reply(403, { error: 'assinatura_nao_vinculada' })
      const prices = await getPrices(db)
      const change = subscriptionFromPreapproval(
        pre,
        prices,
        currentId ?? null,
        Date.now(),
        (isPending ? sub?.pending_amount : sub?.provider_amount) ?? null,
        asInterval(
          isPending ? sub?.pending_billing_interval : (sub?.billing_interval_contracted ?? sub?.billing_interval),
        ),
      )
      if (!change) return reply(200, { pro: false })
      if (isPending && change.patch.status === 'active') {
        const oldId = currentId
        const { error: saveError } = await db
          .from('subscriptions')
          .update({
            ...change.patch,
            pending_subscription_id: null,
            pending_amount: null,
            pending_billing_interval: null,
            pending_checkout_at: null,
            pending_checkout_token: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('pending_subscription_id', id)
        if (saveError) throw saveError
        if (oldId && oldId !== id) await cancelPreapproval(oldId)
      } else if (!isPending) {
        const { error: updateError } = await db
          .from('subscriptions')
          .update({ ...change.patch, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('provider_subscription_id', id)
        if (updateError) throw updateError
      }
      return reply(200, { pro: change.patch.status === 'active' })
    }

    if (body.acao === 'cancelar') {
      const linked = await findLinkedPreapprovals(db, user.id)
      if (!linked.ids.length) return reply(409, { error: 'sem_assinatura' })
      // O cancelamento sempre tenta também os checkouts pendentes e assinaturas pausadas previamente vinculados.
      await Promise.all(linked.ids.map((id) => cancelPreapproval(id)))
      if (sub?.provider_subscription_id) {
        const change = subscriptionFromPreapproval(
          await getPreapproval(sub.provider_subscription_id),
          await getPrices(db),
          sub.provider_subscription_id,
          Date.now(),
          sub.provider_amount ?? null,
          asInterval(sub.billing_interval_contracted ?? sub.billing_interval),
        )
        if (change?.userId === user.id) await saveSubscription(db, user.id, change.patch)
      }
      const { error: clearError } = await db
        .from('subscriptions')
        .update({
          pending_subscription_id: null,
          pending_amount: null,
          pending_billing_interval: null,
          pending_checkout_at: null,
          pending_checkout_token: null,
        })
        .eq('user_id', user.id)
      if (clearError) throw clearError
      return reply(200, { ok: true })
    }

    return reply(400, { error: 'acao_invalida' })
  } catch (e) {
    console.error('assinatura', user.id, e instanceof Error ? e.message : e)
    return reply(502, { error: 'provedor_indisponivel' })
  }
})
