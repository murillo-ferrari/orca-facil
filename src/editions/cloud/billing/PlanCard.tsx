import { useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Crown } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CardSkeleton } from '../../../components/ui'
import { toast } from '../../../components/toast'
import { confirmDialog } from '../../../components/confirm'
import { formatCurrency } from '../../../lib/format'
import { callAssinatura, confirmSubscription, loadPlan, usePlan, watchPlan } from './planStore'

/**
 * Ajustes › Plano (edição Cloud): plano atual e uso do mês. Quem não é Pro vê a chamada para a página
 * /assinatura (onde estão preços e comparação); quem é Pro pode cancelar.
 */
export default function PlanCard() {
  const { loaded, view, prices, busy } = usePlan()
  useEffect(watchPlan, [])
  const benefitsId = useId()

  async function cancel() {
    const ok = await confirmDialog({
      title: 'Cancelar o plano Pro',
      message: `A renovação automática será cancelada. O Pro continua valendo até o fim do período já pago; seus dados continuam na conta e você pode exportar um backup em arquivo.`,
      confirmLabel: 'Cancelar assinatura',
      danger: true,
    })
    if (ok && (await callAssinatura('cancelar'))) {
      toast('Assinatura cancelada')
      await loadPlan()
    }
  }

  // Até a primeira leitura, não dá para saber o plano: mostrar "Grátis" seria um flash errado para quem é Pro.
  // O mesmo skeleton do carregamento do código (Settings.tsx), para não trocar de altura entre os dois.
  if (!loaded) return <CardSkeleton className="h-[218px] sm:h-[186px]" />

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
        description={view.pro ? view.detail : 'Sem sincronização na nuvem. Seus dados ficam só neste aparelho.'}
      />
      <div className="space-y-3 p-4 sm:p-5">
        {!view.pro && (
          <>
            <p className="text-sm text-slate-600">
              Com o <strong>Pro</strong>, seus dados sincronizam entre aparelhos
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
        {view.pro && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id={benefitsId} className="text-[15px] font-semibold text-slate-900">
                Benefícios do seu plano
              </h2>
              <ul aria-labelledby={benefitsId} className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                <li className="flex items-center gap-1.5">
                  <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Dados na nuvem
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Orçamentos e empresas sem limite
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Sincronização entre dispositivos
                </li>
              </ul>
            </div>
            {view.canCancel && (
              <Button variant="danger" onClick={cancel} disabled={busy}>
                Cancelar assinatura
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
