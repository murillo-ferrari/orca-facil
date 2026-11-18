/** Notificações rápidas: chame `toast('mensagem')` de qualquer lugar; o <Toaster/> as exibe. */
import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error'
}

export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }))

let counter = 0
export function toast(message: string, kind: Toast['kind'] = 'success') {
  const id = ++counter
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
}
