import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { syncNow, useSyncState } from './controller'
import { cn } from '../../../components/styles'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Indicador de sincronização (plano 7.7). `compact`: só o ícone na tela, com o texto para leitores de tela. */
export default function SyncStatus({ compact }: { compact?: boolean }) {
  const phase = useSyncState((s) => s.phase)
  const pending = useSyncState((s) => s.pending)
  const rejected = useSyncState((s) => s.rejected)

  let Icon = CloudCheck
  let text = 'Sincronizado'
  let tone = 'text-slate-500'
  if (phase === 'syncing') {
    Icon = RefreshCw
    text = 'Sincronizando…'
  } else if (phase === 'offline') {
    Icon = CloudOff
    text = pending ? `Offline — ${plural(pending, 'alteração pendente', 'alterações pendentes')}` : 'Offline'
  } else if (phase === 'error') {
    Icon = CloudAlert
    text = 'Erro ao sincronizar'
    tone = 'text-red-600'
  } else if (rejected) {
    Icon = CloudAlert
    text = plural(rejected, 'alteração não enviada', 'alterações não enviadas')
    tone = 'text-amber-700'
  } else if (pending) {
    Icon = Cloud
    text = plural(pending, 'alteração pendente', 'alterações pendentes')
  }

  return (
    <div role="status" className={cn('flex items-center gap-2 text-xs', tone)} title={compact ? text : undefined}>
      <Icon size={compact ? 18 : 14} className={cn('shrink-0', phase === 'syncing' && 'motion-safe:animate-spin')} />
      <span className={cn(compact && 'sr-only')}>{text}</span>
      {phase === 'error' && (
        <button type="button" className="font-medium underline" onClick={() => void syncNow()}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}
