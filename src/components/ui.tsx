import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn, inputClass } from './styles'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-200',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
}
const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-20 py-2 leading-relaxed', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(inputClass, 'pr-8', className)} {...props} />
}

export function Field({
  label,
  hint,
  error,
  className,
  children,
  htmlFor,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

/** Campo com label que gera id automaticamente para o input */
export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode; hint?: ReactNode; error?: ReactNode }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={id}>
      <Input id={id} aria-invalid={!!error} {...props} />
    </Field>
  )
}

export function Card({ className, children, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-xs', className)} {...props}>
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md font-medium transition',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]',
        size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  )
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}
