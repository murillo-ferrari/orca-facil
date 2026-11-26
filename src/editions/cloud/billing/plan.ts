/**
 * Texto do cartão "Plano" a partir da assinatura (linha de `subscriptions`). Puro, testado sem navegador.
 * Espelha `private.current_plan()`: o Pro vale até 7 dias depois do fim do período (tolerância de inadimplência).
 */

export interface Subscription {
  plan: string
  status: string
  billing_interval: string | null
  current_period_end: string | null
}

export interface PlanView {
  pro: boolean
  title: string
  detail: string | null
  /** Pode cancelar (Pro com renovação automática ativa) */
  canCancel: boolean
}

const GRACE_MS = 7 * 24 * 60 * 60 * 1000

export function planView(sub: Subscription | null, now: number, fmtDate: (iso: string) => string): PlanView {
  const end = sub?.current_period_end ? Date.parse(sub.current_period_end) : null
  const pro = sub?.plan === 'pro' && (end === null || end + GRACE_MS > now)
  if (!sub || !pro) return { pro: false, title: 'Sem plano', detail: null, canCancel: false }

  const title = `Pro${sub.billing_interval ? ` ${sub.billing_interval}` : ''}`
  const date = sub.current_period_end ? fmtDate(sub.current_period_end) : null
  if (sub.status === 'canceled')
    return { pro, title, detail: date ? `Cancelado: vale até ${date}.` : 'Cancelado.', canCancel: false }
  if (sub.status === 'past_due' || (end !== null && end < now))
    return {
      pro,
      title,
      detail: 'Pagamento pendente. Regularize no Mercado Pago para não perder a sincronização.',
      canCancel: true,
    }
  return { pro, title, detail: date ? `Renova em ${date}.` : null, canCancel: true }
}
