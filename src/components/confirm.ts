/**
 * Confirmação em modal (no lugar de `window.confirm`): `if (await confirmDialog({ ... })) { ... }`.
 * O <ConfirmHost/> (montado uma vez no App) mostra o modal. Resolve `true` ao confirmar e `false` ao cancelar,
 * fechar com Esc ou clicar fora.
 */
import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  message: string
  /** Texto do botão de confirmação (padrão: "Confirmar") */
  confirmLabel?: string
  /** Ação destrutiva: botão de confirmação em vermelho e foco no "Cancelar" */
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

export const useConfirm = create<{ pending: Pending | null }>(() => ({ pending: null }))

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // Pedido anterior ainda aberto (não deveria acontecer): conta como cancelado
    useConfirm.getState().pending?.resolve(false)
    useConfirm.setState({ pending: { ...options, resolve } })
  })
}

/** Responde ao pedido aberto e fecha o modal. Chamado pelo <ConfirmHost/>. */
export function answerConfirm(ok: boolean) {
  const pending = useConfirm.getState().pending
  if (!pending) return
  useConfirm.setState({ pending: null })
  pending.resolve(ok)
}
