import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Crown } from 'lucide-react'
import { Badge, Button, Card, CardHeader } from '../../../components/ui'
import { toast } from '../../../components/toast'
import { confirmDialog } from '../../../components/confirm'
import { formatCurrency } from '../../../lib/format'
import { callAssinatura, confirmSubscription, loadPlan, usePlan, watchPlan } from './planStore'

/**
 * Ajustes › Plano (edição Cloud): plano atual e uso do mês. Quem não é Pro vê a chamada para a página
 * /assinatura (onde estão preços e comparação); quem é Pro pode cancelar.
 */
export default function PlanCard() {
  const { loaded, view, use, prices, busy } = usePlan()
  useEffect(watchPlan, [])

  async function cancel() {
    const ok = await confirmDialog({
      title: 'Cancelar o plano Pro',
      message: `A renovação automática será cancelada. O Pro continua valendo até o fim do período já pago; depois, a conta volta ao plano grátis sem perder nenhum dado.`,
      confirmLabel: 'Cancelar assinatura',
      danger: true,
    })
    if (ok && (await callAssinatura('cancelar'))) {
      toast('Assinatura cancelada')
      await loadPlan()
    }
  }

  // Até a primeira leitura, não dá para saber o plano: mostrar "Grátis" seria um flash errado para quem é Pro
  if (!loaded)
    return (
      <Card aria-busy="true">
        <CardHeader
          icon={<Crown size={18} />}
          title={
            <span className="flex items-center gap-2">
              Plano <span className="h-5 w-16 rounded-full bg-slate-200 motion-safe:animate-pulse" aria-hidden />
            </span>
          }
          description={
            <>
              <span className="sr-only">Carregando o plano…</span>
              <span className="inline-block h-3.5 w-56 max-w-full rounded bg-slate-200 motion-safe:animate-pulse" />
            </>
          }
        />
        {/* Mesma altura do conteúdo carregado, para nada pular */}
        <div className="space-y-3 p-4 sm:p-5" aria-hidden>
          <div className="h-5 w-full rounded bg-slate-200 motion-safe:animate-pulse" />
          <div className="h-10 w-56 max-w-full rounded-lg bg-slate-200 motion-safe:animate-pulse" />
        </div>
      </Card>
    )

  return (
    <Card>
      <CardHeader
        icon={<Crown size={18} />}
        title={
          <span className="flex items-center gap-2">
            Plano{' '}
            <Badge className={view.pro ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-700'}>
              {view.title}
            </Badge>
          </span>
        }
        description={
          view.pro
            ? view.detail
            : use?.limite_orcamentos_no_mes
              ? `${use.orcamentos_no_mes} de ${use.limite_orcamentos_no_mes} orçamentos novos neste mês · 1 empresa.`
              : 'Até 15 orçamentos novos por mês e 1 empresa.'
        }
      />
      <div className="space-y-3 p-4 sm:p-5">
        {!view.pro && (
          <>
            <p className="text-sm text-slate-600">
              Com o <strong>Pro</strong>, orçamentos e empresas ilimitados
              {prices.mensal ? `, a partir de ${formatCurrency(prices.mensal)}/mês` : ''}.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/assinatura"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                Conhecer o Pro <ArrowRight size={16} aria-hidden />
              </Link>
              <Button variant="ghost" onClick={() => void confirmSubscription()} disabled={busy}>
                Já assinei
              </Button>
            </div>
          </>
        )}
        {view.canCancel && (
          <Button variant="ghost" onClick={cancel} disabled={busy}>
            Cancelar assinatura
          </Button>
        )}
      </div>
    </Card>
  )
}
