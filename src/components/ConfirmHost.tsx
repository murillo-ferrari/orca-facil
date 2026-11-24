import { answerConfirm, useConfirm } from './confirm'
import { Button, Modal } from './ui'

/** Mostra o modal das confirmações pedidas por `confirmDialog()`. Montar uma vez, junto do <Toaster/>. */
export function ConfirmHost() {
  const pending = useConfirm((s) => s.pending)

  return (
    <Modal
      open={!!pending}
      onClose={() => answerConfirm(false)}
      title={pending?.title ?? ''}
      footer={
        <>
          {/* Em ação destrutiva o foco inicial vai para "Cancelar" (o caminho seguro) */}
          <Button data-autofocus={pending?.danger || undefined} onClick={() => answerConfirm(false)}>
            Cancelar
          </Button>
          <Button
            variant={pending?.danger ? 'danger' : 'primary'}
            data-autofocus={!pending?.danger || undefined}
            onClick={() => answerConfirm(true)}
          >
            {pending?.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      }
    >
      <p className="text-sm whitespace-pre-line text-slate-700">{pending?.message}</p>
    </Modal>
  )
}
