import { useState } from 'react'
import { GitMerge } from 'lucide-react'
import { Button, Card, CardHeader } from '../../../components/ui'
import { formatDate } from '../../../lib/format'
import { TABLE_LABEL, titleOf, type Rec } from './conflicts'
import { useSyncState } from './controller'
import { conflictKey, type ConflictRecord } from './engine'
import { ConflictDialog } from './ConflictDialog'

/** Ajustes › Conflitos de sincronização (edição Cloud): itens alterados em dois dispositivos, aguardando decisão. */
export default function ConflictsCard() {
  const conflicts = useSyncState((s) => s.conflicts)
  const [open, setOpen] = useState<ConflictRecord | null>(null)

  return (
    <Card>
      <CardHeader
        icon={<GitMerge size={18} />}
        title="Conflitos de sincronização"
        description="Itens que você e outro dispositivo alteraram ao mesmo tempo. Enquanto você não decide, vale a versão da nuvem. Sem decisão, o aviso some depois de 30 dias."
      />
      {conflicts.length === 0 ? (
        <p className="p-4 text-sm text-slate-500 sm:p-5">Nenhum conflito pendente.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {conflicts.map((c) => (
            <li key={conflictKey(c)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {TABLE_LABEL[c.table]}: {titleOf(c.table, (c.local ?? c.server ?? null) as Rec | null)}
                </p>
                <p className="text-xs text-slate-500">{formatDate(c.at, 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <Button size="sm" onClick={() => setOpen(c)}>
                Resolver
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConflictDialog conflict={open} onClose={() => setOpen(null)} />
    </Card>
  )
}
