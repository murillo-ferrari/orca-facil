import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore } from '../store/store'
import { cn, inputClass } from './ui'

/**
 * Seletor de unidades configuráveis. Fechado mostra só a sigla (compacto);
 * aberto mostra sigla + nome. Mantém a unidade atual mesmo que tenha sido removida da lista.
 */
export function UnitSelect({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<'select'>, 'value' | 'onChange'> & { value: string; onValueChange: (v: string) => void }) {
  const units = useStore((s) => s.units)
  const current = units.find((u) => u.symbol === value)
  return (
    <div
      className={cn(
        inputClass,
        'relative flex items-center justify-between gap-1 focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-100',
        className,
      )}
      title={current?.name}
    >
      <span className="truncate font-medium">{value || '—'}</span>
      <ChevronDown size={14} className="shrink-0 text-slate-400" />
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        {...props}
      >
        {!current && value && <option value={value}>{value}</option>}
        {units.map((u) => (
          <option key={u.id} value={u.symbol}>
            {u.symbol} — {u.name}
          </option>
        ))}
      </select>
    </div>
  )
}
