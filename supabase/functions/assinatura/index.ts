// Assinatura do plano Pro pelo Mercado Pago (Edge Function, Deno). Ver docs/plano-versao-cloud.md, seção 9.3.
//
// POST { acao: 'assinar', periodo: 'mensal' | 'anual' } → { url } do checkout do Mercado Pago
// POST { acao: 'confirmar' } → { pro } depois de consultar o Mercado Pago (não espera o webhook)
// POST { acao: 'cancelar' } → cancela no Mercado Pago; o Pro vale até o fim do período já pago
//
// O valor cobrado vem da tabela plan_prices, nunca do app. O plano muda pelo webhook ou aqui (confirmar/cancelar),
// sempre a partir do estado lido na API do Mercado Pago e com a chave de serviço.
import { pickSubscription, subscriptionFromPreapproval, type Preapproval } from '../_shared/mercadopago.ts'
import {
  admin,
  cancelPreapproval,
  cors,
  getPreapproval,
  getPrices,
  mp,
  reply,
  saveSubscription,
} from '../_shared/server.ts'

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
      const price = prices.find((p) => p.billing_interval === body.periodo)
      if (!price) return reply(400, { error: 'periodo_invalido' })
      const ativo = sub?.plan === 'pro' && sub.status === 'active' && sub.provider_subscription_id
      if (ativo) return reply(409, { error: 'ja_assinante' })

      const pre = await mp<Preapproval & { init_point: string }>('/preapproval', {
        method: 'POST',
        body: JSON.stringify({
          reason: `Orçafácil Pro (${price.billing_interval})`,
          external_reference: user.id,
          // ponytail: só no staging. Com credencial de teste, o pagador precisa ser o comprador de teste do
          // Mercado Pago; em produção este secret não existe e vale o e-mail da conta.
          payer_email: Deno.env.get('MP_TEST_PAYER_EMAIL') || user.email,
          back_url: `${Deno.env.get('APP_URL')}/ajustes`,
          // Para assinaturas o Mercado Pago só avisa na URL passada aqui (o cadastro em "Suas integrações" não vale)
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
      return reply(200, { url: pre.init_point })
    }

    // Não depende do webhook: lê no Mercado Pago as assinaturas deste usuário (external_reference = user_id, definido
    // só por esta função) e grava o estado: autorizada vira Pro; a já gravada reflete pausa/atraso/cancelamento
    // feitos fora do app. Chamado ao voltar do checkout, pelo botão "Já assinei" e uma vez por sessão (assinantes).
    if (body.acao === 'confirmar') {
      const found = await mp<{ results?: Preapproval[] }>(
        `/preapproval/search?external_reference=${encodeURIComponent(user.id)}`,
      )
      const change = pickSubscription(
        found.results ?? [],
        await getPrices(db),
        user.id,
        sub?.provider_subscription_id ?? null,
      )
      if (change) await saveSubscription(db, user.id, change.patch)
      return reply(200, { pro: change?.patch.status === 'active' })
    }

    if (body.acao === 'cancelar') {
      const id = sub?.provider_subscription_id
      if (!id || sub.status === 'canceled') return reply(409, { error: 'sem_assinatura' })
      await cancelPreapproval(id)
      // Grava já (sem esperar o webhook), a partir do estado real no Mercado Pago
      const change = subscriptionFromPreapproval(await getPreapproval(id), await getPrices(db), id)
      if (change?.userId === user.id) await saveSubscription(db, user.id, change.patch)
      return reply(200, { ok: true })
    }

    return reply(400, { error: 'acao_invalida' })
  } catch (e) {
    console.error('assinatura', user.id, e instanceof Error ? e.message : e)
    return reply(502, { error: 'provedor_indisponivel' })
  }
})
