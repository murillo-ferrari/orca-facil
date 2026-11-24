import { create } from 'zustand'
import { toast } from '../../../components/toast'
import { formatDate } from '../../../lib/format'
import { supabase } from '../supabase'
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
  use: { orcamentos_no_mes: number; limite_orcamentos_no_mes: number | null } | null
  busy: boolean
}

const EMPTY: PlanState = {
  loaded: false,
  view: { pro: false, title: 'Grátis', detail: null, canCancel: false },
  prices: {},
  use: null,
  busy: false,
}

export const usePlan = create<PlanState>(() => EMPTY)

let inflight: Promise<void> | null = null
let returnChecked = false

/** Lê plano, preços e uso. Chamadas simultâneas compartilham a mesma leitura. */
export function loadPlan() {
  inflight ??= (async () => {
    // Volta do checkout: o Mercado Pago acrescenta ?preapproval_id= ao back_url. Confirma sem esperar o webhook.
    if (!returnChecked) {
      returnChecked = true
      if (new URLSearchParams(location.search).has('preapproval_id')) {
        history.replaceState(null, '', location.pathname)
        const data = await callAssinatura('confirmar')
        if (data?.pro) toast('Plano Pro ativo. Obrigado!')
      }
    }
    const [s, p, u] = await Promise.all([
      supabase.from('subscriptions').select('plan, status, billing_interval, current_period_end').maybeSingle(),
      supabase.from('plan_prices').select('billing_interval, amount'),
      supabase.rpc('uso_do_plano'),
    ])
    usePlan.setState({
      loaded: true,
      view: planView(s.data as Subscription | null, Date.now(), (iso) => formatDate(iso)),
      prices: Object.fromEntries((p.data ?? []).map((x) => [x.billing_interval, Number(x.amount)])),
      use: u.data as PlanState['use'],
    })
  })().finally(() => (inflight = null))
  return inflight
}

/** Chama a Edge Function `assinatura`. Erro vira aviso e retorna null. */
export async function callAssinatura(acao: 'assinar' | 'cancelar' | 'confirmar', periodo?: Interval) {
  usePlan.setState({ busy: true })
  const { data, error } = await supabase.functions.invoke<{ url?: string; pro?: boolean }>('assinatura', {
    method: 'POST',
    body: { acao, periodo },
  })
  usePlan.setState({ busy: false })
  if (error) {
    toast('Não foi possível falar com o Mercado Pago. Tente de novo em instantes.', 'error')
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
  const data = await callAssinatura('confirmar')
  if (!data) return
  await loadPlan()
  toast(data.pro ? 'Plano Pro ativo' : 'Nenhum pagamento aprovado encontrado ainda', data.pro ? 'success' : 'error')
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
  if (event === 'SIGNED_OUT') usePlan.setState(EMPTY)
})
