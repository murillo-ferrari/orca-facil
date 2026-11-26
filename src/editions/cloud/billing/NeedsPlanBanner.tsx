import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { usePlan, watchPlan } from './planStore'

/**
 * Faixa no topo do app para a conta SEM plano Pro (nova ou com assinatura vencida). Na nuvem só grava quem tem Pro:
 * a conta continua lendo tudo e exportando backup, mas o servidor recusa novas gravações. Sem este aviso, a pessoa
 * editaria sem perceber que nada está sendo salvo na nuvem.
 */
export default function NeedsPlanBanner() {
  const noPlan = usePlan((s) => s.loaded && !s.view.pro)
  const { pathname } = useLocation()
  useEffect(watchPlan, [])
  if (!noPlan || pathname === '/assinatura') return null

  return (
    <div role="status" className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <Crown size={20} className="shrink-0 text-brand-700" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-slate-800">
          <strong>Sua conta está sem plano.</strong> Na nuvem, novas alterações só são salvas com o plano Pro. Você
          continua vendo seus dados e pode exportar um backup. Para usar de graça, use a versão no aparelho.
        </p>
        <Link
          to="/assinatura"
          className="inline-flex h-10 shrink-0 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Ver o plano Pro
        </Link>
      </div>
    </div>
  )
}
