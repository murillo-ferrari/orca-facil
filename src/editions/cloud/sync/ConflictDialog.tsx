import { useState } from 'react'
import { Button, Modal, Segmented } from '../../../components/ui'
import { formatDate } from '../../../lib/format'
import { useStore } from '../../../store/store'
import type { ConflictRecord } from './engine'
import { ITEM, TABLE_LABEL, compareRecords, labelOf, titleOf, toLines, type Choice, type Rec } from './conflicts'
import { DiffView } from './DiffView'
import { findRecord } from './mapping'
import { dismissConflict, resolveConflict } from './controller'

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'server', label: 'Manter a da nuvem' },
  { value: 'local', label: 'Usar a minha' },
]

/**
 * Resolução de um conflito, no estilo da mescla dos editores de código: cada campo em que os dois lados mudaram
 * de forma diferente aparece em diff (nuvem em vermelho, sua versão em verde) e a pessoa escolhe um lado.
 * Campos que só um lado mudou não aparecem: a mescla os leva sozinha.
 */
export function ConflictDialog({ conflict, onClose }: { conflict: ConflictRecord | null; onClose: () => void }) {
  return (
    <Modal open={!!conflict} onClose={onClose} size="lg" title="Resolver conflito">
      {conflict && (
        <Body key={`${conflict.table}:${conflict.id}:${conflict.at}`} conflict={conflict} onClose={onClose} />
      )}
    </Modal>
  )
}

function Body({ conflict, onClose }: { conflict: ConflictRecord; onClose: () => void }) {
  const current = useStore((s) => findRecord(s, conflict.table, conflict.id)) as Rec | null
  const local = conflict.local as Rec | null
  const server = (conflict.server === undefined ? current : conflict.server) as Rec | null
  const itemLevel = local === null || server === null

  const fields = itemLevel ? [] : compareRecords((conflict.base ?? null) as Rec | null, local, server).conflicts
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const choose = (key: string, v: Choice) => setChoices((c) => ({ ...c, [key]: v }))
  const pending = itemLevel ? [ITEM] : fields.map((f) => f.key)
  const ready = pending.every((k) => choices[k])

  const outdated = conflict.server === undefined || conflict.local === undefined
  const apply = async () => {
    onClose()
    await resolveConflict(conflict, choices)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-slate-900">
          {TABLE_LABEL[conflict.table]}: {titleOf(conflict.table, local ?? server)}
        </p>
        <p className="text-sm text-slate-600">
          Você e outro dispositivo alteraram este item. Detectado em {formatDate(conflict.at, 'dd/MM/yyyy HH:mm')}.
          {!itemLevel && ' Para cada campo abaixo, escolha qual versão vale.'}
        </p>
      </div>

      {outdated ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          Este conflito foi registrado por uma versão anterior do app e não guardou a versão da nuvem. A da nuvem já
          está no app. Você pode descartá-lo.
        </p>
      ) : itemLevel ? (
        <section aria-labelledby="item-conflict" className="space-y-2">
          <h3 id="item-conflict" className="text-sm font-semibold text-slate-900">
            {local === null ? 'Você excluiu este item, mas ele mudou na nuvem' : 'Este item foi excluído na nuvem'}
          </h3>
          <DiffView
            serverTitle="Na nuvem"
            localTitle="Sua versão"
            serverLines={server ? toLines(server) : ['(item excluído)']}
            localLines={local ? toLines(local) : ['(item excluído)']}
          />
          <Segmented
            ariaLabel="Qual versão vale"
            value={(choices[ITEM] ?? '') as Choice}
            options={
              local === null
                ? [
                    { value: 'server', label: 'Manter o item da nuvem' },
                    { value: 'local', label: 'Excluir mesmo assim' },
                  ]
                : [
                    { value: 'server', label: 'Aceitar a exclusão' },
                    { value: 'local', label: 'Manter o meu item' },
                  ]
            }
            onChange={(v) => choose(ITEM, v)}
          />
        </section>
      ) : (
        fields.map((f) => (
          <section key={f.key} aria-labelledby={`f-${f.key}`} className="space-y-2">
            <h3 id={`f-${f.key}`} className="text-sm font-semibold text-slate-900">
              {labelOf(f.key)}
            </h3>
            <DiffView serverLines={toLines(f.server, f.key)} localLines={toLines(f.local, f.key)} />
            <Segmented
              ariaLabel={`Qual versão vale para ${f.label}`}
              size="sm"
              value={(choices[f.key] ?? '') as Choice}
              options={OPTIONS}
              onChange={(v) => choose(f.key, v)}
            />
          </section>
        ))
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
        <Button
          variant="ghost"
          onClick={async () => {
            onClose()
            await dismissConflict(conflict)
          }}
        >
          {outdated ? 'Descartar' : 'Manter tudo da nuvem'}
        </Button>
        {!outdated && (
          <Button variant="primary" disabled={!ready} onClick={apply}>
            {ready ? 'Aplicar escolhas' : `Escolha ${pending.length - Object.keys(choices).length} restante(s)`}
          </Button>
        )}
      </div>
    </div>
  )
}
