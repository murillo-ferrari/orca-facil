import { Cloud, CloudAlert, CloudCheck, CloudOff, GitMerge, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { syncNow, useSyncState } from './controller'
import { limitNotice } from './limits'
import { cn } from '../../../components/styles'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Indicador de sincronização (plano 7.7). `compact`: só o ícone na tela, com o texto para leitores de tela. */
export default function SyncStatus({ compact }: { compact?: boolean }) {
  const phase = useSyncState((s) => s.phase)
  const pending = useSyncState((s) => s.pending)
  const rejected = useSyncState((s) => s.rejected)
  const conflicts = useSyncState((s) => s.conflicts.length)
  const limit = useSyncState((s) => limitNotice(s.limitTables, null)?.short ?? '')

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
  } else if (conflicts) {
    Icon = GitMerge
    text = plural(conflicts, 'conflito para resolver', 'conflitos para resolver')
    tone = 'text-amber-700'
  } else if (rejected) {
    Icon = CloudAlert
    // Com limite do plano, diz o motivo; sem ele, só a contagem
    text = limit || plural(rejected, 'alteração não enviada', 'alterações não enviadas')
    tone = 'text-amber-700'
  } else if (pending) {
    Icon = Cloud
    text = plural(pending, 'alteração pendente', 'alterações pendentes')
  }

  return (
    <div role="status" className={cn('flex items-center gap-2 text-xs', tone)} title={compact ? text : undefined}>
      <Icon size={compact ? 18 : 14} className={cn('shrink-0', phase === 'syncing' && 'motion-safe:animate-spin')} />
      <span className={cn(compact && 'sr-only')}>{text}</span>
      {phase === 'idle' && (conflicts > 0 || (rejected > 0 && limit)) && (
        <Link to={conflicts > 0 ? '/ajustes/dados' : '/ajustes'} className="font-medium underline">
          {conflicts > 0 ? 'Resolver' : 'Ver detalhes'}
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
