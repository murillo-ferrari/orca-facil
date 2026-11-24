import { TriangleAlert } from 'lucide-react'
import { Card } from '../../../components/ui'
import { useSyncState } from './controller'
import { limitNotice } from './limits'

/**
 * Ajustes › aviso de limite do plano (edição Cloud): aparece só quando o servidor recusou alterações por limite,
 * dizendo o motivo, o uso e o que fazer. Não há botão de plano ainda (F7); quando houver, entra aqui.
 */
export default function LimitCard() {
  const tables = useSyncState((s) => s.limitTables)
  const use = useSyncState((s) => s.planUse)
  const notice = limitNotice(tables, use)
  if (!notice) return null

  return (
    <Card className="border-amber-300 bg-amber-50">
      <div className="flex gap-3 p-4 sm:p-5" role="status">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="space-y-2 text-sm text-slate-800">
          <h2 className="text-[15px] font-semibold text-slate-900">{notice.short}</h2>
          {notice.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </Card>
  )
}
