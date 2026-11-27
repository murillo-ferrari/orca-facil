import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { BrandingCard } from '../../../components/BrandingCard'
import { BRANDING_SKELETON } from '../../../components/skeletons'
import { CardSkeleton } from '../../../components/ui'
import type { Branding } from '../../../types'
import { usePlan, watchPlan } from './planStore'

interface Props {
  value: Branding
  onChange: (value: Branding) => void
  companyName: string
}

/** "Logotipo e cores do PDF" na edição Cloud: liberado para o Pro; sem Pro, mostra o convite para assinar. */
export default function BrandingSection(props: Props) {
  const loaded = usePlan((s) => s.loaded)
  const pro = usePlan((s) => s.view.pro)
  useEffect(watchPlan, [])
  if (!loaded) return <CardSkeleton lines={1} className={BRANDING_SKELETON} />
  return (
    <BrandingCard
      {...props}
      locked={!pro}
      upgrade={
        <Link
          to="/assinatura"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-brand-50 px-3.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          <Crown size={16} aria-hidden /> Conhecer o plano Pro
        </Link>
      }
    />
  )
}
