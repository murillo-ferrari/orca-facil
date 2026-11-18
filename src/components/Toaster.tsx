import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from './styles'
import { useToasts } from './toast'

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 print:hidden"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg',
            t.kind === 'success' ? 'bg-slate-900' : 'bg-red-600',
          )}
        >
          {t.kind === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  )
}
