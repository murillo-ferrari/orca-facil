import { FunctionsHttpError } from '@supabase/supabase-js'
import { create } from 'zustand'
import { toast } from '../../../components/toast'
import { formatDate } from '../../../lib/format'
import { supabase } from '../supabase'
import { setBrandingAllowed } from '../../branding'
import { planView, type PlanView, type Subscription } from './plan'

/**
 * Plano do usuário, compartilhado pela sidebar (CTA), pela página /assinatura e por Ajustes › Plano.
 * Quem muda o plano é o servidor (webhook ou função `assinatura`); aqui só se lê e se chama a função.
 */

export type Interval = 'mensal' | 'anual'

interface PlanState {
  /** Primeira leitura concluída: antes disso não se sabe o plano (nada de mostrar "Grátis" por engano) */
  loaded: boolean
  view: PlanView
  prices: Partial<Record<Interval, number>>
  busy: boolean
}

const EMPTY: PlanState = {
  loaded: false,
  view: { pro: false, title: 'Sem plano', detail: null, canCancel: false },
  prices: {},
  busy: false,
}

export const usePlan = create<PlanState>(() => EMPTY)

// Logotipo e cor no PDF são do Pro. ponytail: antes da primeira leitura do plano (poucos instantes após abrir o app)
// o PDF sai no visual padrão; se isso incomodar, esperar `loaded` antes de gerar o PDF.
usePlan.subscribe((s) => setBrandingAllowed(s.loaded && s.view.pro))

let inflight: Promise<void> | null = null
let returnChecked = false
let reconciled = false

/** Lê plano, preços e uso. Chamadas simultâneas compartilham a mesma leitura. */
export function loadPlan() {
  inflight ??= (async () => {
    // Volta do checkout: o Mercado Pago acrescenta ?preapproval_id= ao back_url. Confirma sem esperar o webhook.
    if (!returnChecked) {
      returnChecked = true
      const callbackId = new URLSearchParams(location.search).get('preapproval_id')
      if (callbackId) {
        history.replaceState(null, '', location.pathname)
        const data = await callAssinatura('confirmar', undefined, callbackId)
        if (data?.pro) toast('Plano Pro ativo. Obrigado!')
      }
    }
    const [s, p] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('plan, status, billing_interval, current_period_end, provider_subscription_id')
        .maybeSingle(),
      supabase.from('plan_prices').select('billing_interval, amount'),
    ])
    const apply = (sub: unknown) =>
      usePlan.setState({
        loaded: true,
        view: planView(sub as Subscription | null, Date.now(), (iso) => formatDate(iso)),
        prices: Object.fromEntries((p.data ?? []).map((x) => [x.billing_interval, Number(x.amount)])),
      })
    apply(s.data)

    // Quem já assina: uma vez por sessão, confere no Mercado Pago (cancelamento, pausa ou atraso feitos pelo painel
    // do Mercado Pago não chegam sozinhos se o webhook falhar). Silencioso: erro aqui não incomoda ninguém.
    if (!reconciled && s.data?.plan === 'pro') {
      reconciled = true
      const { error } = await supabase.functions.invoke('assinatura', {
        method: 'POST',
        body: { acao: 'confirmar', preapproval_id: s.data.provider_subscription_id },
      })
      if (!error)
        apply(
          (
            await supabase
              .from('subscriptions')
              .select('plan, status, billing_interval, current_period_end')
              .maybeSingle()
          ).data,
        )
    }
  })().finally(() => (inflight = null))
  return inflight
}

/** Motivo (`{ error }`) que a função devolveu no corpo de uma resposta de erro. */
const reasonOf = (e: FunctionsHttpError): Promise<string | null> =>
  (e.context as Response).json().then(
    (b: { error?: string }) => b?.error ?? null,
    () => null,
  )

/** Chama a Edge Function `assinatura`. Erro vira aviso e retorna null. */
export async function callAssinatura(
  acao: 'assinar' | 'cancelar' | 'confirmar',
  periodo?: Interval,
  preapprovalId?: string | null,
) {
  usePlan.setState({ busy: true })
  const { data, error } = await supabase.functions.invoke<{ url?: string; pro?: boolean }>('assinatura', {
    method: 'POST',
    body: { acao, periodo, preapproval_id: preapprovalId },
  })
  usePlan.setState({ busy: false })
  // Respostas 4xx/5xx da função chegam como `error` (FunctionsHttpError), com o motivo no corpo; sem corpo, é rede.
  const reason = error instanceof FunctionsHttpError ? await reasonOf(error) : null
  if (error && (!reason || reason === 'provedor_indisponivel')) {
    toast('Não foi possível falar com o Mercado Pago. Tente de novo em instantes.', 'error')
    return null
  }
  const failure = reason ?? (data as { error?: string } | null)?.error
  if (failure) {
    switch (failure) {
      case 'ja_assinante':
        toast('Sua assinatura Pro já está ativa. Confira em Ajustes › Conta e plano.')
        break
      case 'checkout_em_andamento':
        toast('O checkout está sendo preparado. Tente de novo em alguns segundos.', 'error')
        break
      default:
        toast('Não foi possível iniciar o checkout. Tente de novo.', 'error')
    }
    return null
  }
  return data
}

export async function subscribe(periodo: Interval) {
  const data = await callAssinatura('assinar', periodo)
  if (data?.url) location.assign(data.url)
}

/** "Já assinei": consulta o Mercado Pago e atualiza o plano. */
export async function confirmSubscription() {
  const { data: sub } = await supabase.from('subscriptions').select('pending_subscription_id').maybeSingle()
  if (!sub?.pending_subscription_id) {
    toast('Para verificar, volte ao Orçafácil pelo botão do checkout do Mercado Pago.', 'error')
    return
  }
  const data = await callAssinatura('confirmar', undefined, sub.pending_subscription_id)
  if (!data) return
  reconciled = true
  await loadPlan()
  toast(
    data.pro ? 'Plano Pro ativo' : 'Ainda não encontramos um pagamento aprovado para esta conta.',
    data.pro ? 'success' : 'error',
  )
}

/** Relê ao voltar para a aba (o webhook pode ter mudado o plano). Devolve a função que desliga. */
export function watchPlan() {
  void loadPlan()
  const onVisible = () => document.visibilityState === 'visible' && void loadPlan()
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}

// Trocar de conta não pode herdar o plano da anterior
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    usePlan.setState(EMPTY)
    reconciled = false
  }
})
