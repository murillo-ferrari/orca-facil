import { useRef, useState, type ComponentProps } from 'react'
import { cn, inputClass } from './styles'
import { parseBRNumber } from '../lib/format'

const fmt = (v: number, decimals: number, currency: boolean) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: currency ? 2 : 0,
    maximumFractionDigits: decimals,
  }).format(v)

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number
  onValueChange: (v: number) => void
  currency?: boolean
  decimals?: number
  suffix?: string
}

/**
 * Input numérico em formato brasileiro. Exibe valor formatado quando fora de foco
 * e texto livre durante a edição (aceita vírgula ou ponto como decimal).
 */
export function NumberInput({
  value,
  onValueChange,
  currency = false,
  decimals = 2,
  suffix,
  className,
  onFocus,
  onBlur,
  style,
  ...props
}: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  // Evita que o mouseup do clique desfaça a seleção feita no foco
  const justFocused = useRef(false)
  const display = draft ?? (value || value === 0 ? fmt(value, decimals, currency) : '')

  return (
    <div className="relative">
      {currency && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
          R$
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(inputClass, 'text-right tabular-nums', currency && 'pl-9', className)}
        // Espaço do sufixo = largura dele (ch, no mesmo corpo de texto) + as margens de 0,75rem de cada lado
        style={suffix ? { paddingRight: `calc(1.5rem + ${suffix.length}ch)`, ...style } : style}
        value={display}
        onFocus={(e) => {
          justFocused.current = true
          setDraft(value ? fmt(value, decimals, false).replace(/\./g, '') : '')
          const el = e.target
          requestAnimationFrame(() => el.select())
          onFocus?.(e)
        }}
        onMouseUp={(e) => {
          if (justFocused.current) {
            e.preventDefault()
            e.currentTarget.select()
          }
          justFocused.current = false
        }}
        onChange={(e) => {
          const text = e.target.value.replace(/[^\d,.-]/g, '')
          setDraft(text)
          onValueChange(parseBRNumber(text))
        }}
        onBlur={(e) => {
          justFocused.current = false
          setDraft(null)
          onBlur?.(e)
        }}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  )
}
