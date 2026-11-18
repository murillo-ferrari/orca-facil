import { useState } from 'react'
import { useStore } from '../store/store'
import type { Client } from '../types'
import { ClientFields } from './ClientFields'
import { Button, Field, Modal, Textarea } from './ui'
import { toast } from './toast'

/** Modal de cadastro/edição de cliente. Renderize com `key` para reiniciar ao trocar de cliente. */
export function ClientFormModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null
  onClose: () => void
  onSaved?: (c: Client) => void
}) {
  const saveClient = useStore((s) => s.saveClient)
  const isNew = useStore((s) => !!client && !s.clients.some((c) => c.id === client.id))
  const [draft, setDraft] = useState<Client | null>(() => (client ? structuredClone(client) : null))
  const [tried, setTried] = useState(false)

  function handleSave() {
    if (!draft) return
    setTried(true)
    if (!draft.name.trim()) return
    saveClient(draft)
    // Fecha o modal antes de notificar: com o modal aberto, o resto da página fica inerte e o aviso se perde
    onClose()
    onSaved?.(draft)
    toast(isNew ? 'Cliente cadastrado' : 'Cliente atualizado')
  }

  return (
    <Modal
      open={!!client}
      onClose={onClose}
      title={isNew ? 'Novo cliente' : 'Editar cliente'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Salvar cliente
          </Button>
        </>
      }
    >
      {draft && (
        <div className="space-y-4">
          <ClientFields
            autoFocus
            value={draft}
            onChange={setDraft}
            nameError={tried && !draft.name.trim() ? 'Informe o nome do cliente' : undefined}
          />
          <Field label="Anotações internas" hint="Não aparecem no orçamento">
            <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
      )}
    </Modal>
  )
}
