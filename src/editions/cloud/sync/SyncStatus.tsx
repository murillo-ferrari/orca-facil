import { Cloud, CloudAlert, CloudCheck, CloudOff, GitMerge, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { syncNow, useSyncState } from './controller'
import { cn } from '../../../components/styles'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

interface Status {
  phase: string
  pending: number
  rejected: number
  conflicts: number
  needsPlan: boolean
}

/** Ícone, texto e cor do indicador; a primeira situação que vale (por prioridade) decide. */
function statusOf({ phase, pending, rejected, conflicts, needsPlan }: Status) {
  if (phase === 'syncing') return { Icon: RefreshCw, text: 'Sincronizando…', tone: 'text-slate-500' }
  if (phase === 'offline') {
    const text = pending ? `Offline — ${plural(pending, 'alteração pendente', 'alterações pendentes')}` : 'Offline'
    return { Icon: CloudOff, text, tone: 'text-slate-500' }
  }
  if (phase === 'error') return { Icon: CloudAlert, text: 'Erro ao sincronizar', tone: 'text-red-600' }
  if (conflicts) {
    const text = plural(conflicts, 'conflito para resolver', 'conflitos para resolver')
    return { Icon: GitMerge, text, tone: 'text-amber-700' }
  }
  if (rejected) {
    // Sem plano Pro o servidor recusa tudo: diz o motivo; senão, só a contagem
    const text = needsPlan
      ? 'Sem plano Pro: não salvo na nuvem'
      : plural(rejected, 'alteração não enviada', 'alterações não enviadas')
    return { Icon: CloudAlert, text, tone: 'text-amber-700' }
  }
  if (pending) {
    return { Icon: Cloud, text: plural(pending, 'alteração pendente', 'alterações pendentes'), tone: 'text-slate-500' }
  }
  return { Icon: CloudCheck, text: 'Sincronizado', tone: 'text-slate-500' }
}

/** Indicador de sincronização (plano 7.7). `compact`: só o ícone na tela, com o texto para leitores de tela. */
export default function SyncStatus({ compact }: { compact?: boolean }) {
  const phase = useSyncState((s) => s.phase)
  const pending = useSyncState((s) => s.pending)
  const rejected = useSyncState((s) => s.rejected)
  const conflicts = useSyncState((s) => s.conflicts.length)
  const needsPlan = useSyncState((s) => s.needsPlan)

  const { Icon, text, tone } = statusOf({ phase, pending, rejected, conflicts, needsPlan })

  return (
    <div role="status" className={cn('flex items-center gap-2 text-xs', tone)} title={compact ? text : undefined}>
      <Icon size={compact ? 18 : 14} className={cn('shrink-0', phase === 'syncing' && 'motion-safe:animate-spin')} />
      <span className={cn(compact && 'sr-only')}>{text}</span>
      {phase === 'idle' && (conflicts > 0 || (rejected > 0 && needsPlan)) && (
        <Link to={conflicts > 0 ? '/ajustes/dados' : '/assinatura'} className="font-medium underline">
          {conflicts > 0 ? 'Resolver' : 'Ver plano'}
        </Link>
      )}
      {phase === 'error' && (
        <button type="button" className="font-medium underline" onClick={() => void syncNow()}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}
