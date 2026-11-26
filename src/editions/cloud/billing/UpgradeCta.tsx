import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { usePlan, watchPlan } from './planStore'

/**
 * Chamada para o Pro (edição Cloud), só para quem ainda não é Pro e só depois de saber o plano.
 * `compact`: só o ícone (topo do celular); senão, um cartão (sidebar do computador).
 */
export default function UpgradeCta({ compact }: { compact?: boolean }) {
  const show = usePlan((s) => s.loaded && !s.view.pro)
  useEffect(watchPlan, [])
  if (!show) return null

  if (compact)
    return (
      <Link
        to="/assinatura"
        aria-label="Conhecer o plano Pro"
        title="Conhecer o plano Pro"
        className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
      >
        <Crown size={16} aria-hidden /> Pro
      </Link>
    )

  return (
    <Link
      to="/assinatura"
      className="block rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm hover:border-brand-500"
    >
      <span className="flex items-center gap-1.5 font-semibold text-brand-700">
        <Crown size={16} aria-hidden /> Seja Pro
      </span>
      <span className="mt-0.5 block text-xs text-slate-600">
        Seus dados na nuvem, sincronizados entre celular e computador.
      </span>
    </Link>
  )
}
