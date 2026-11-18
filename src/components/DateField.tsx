import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale/pt-BR'
import 'react-day-picker/style.css'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR as dfPtBR } from 'date-fns/locale/pt-BR'
import { parseDate, toISODate } from '../lib/format'
import { Button } from './ui'
import { cn, inputClass } from './styles'

interface Props {
  id?: string
  value: string // yyyy-MM-dd
  onChange: (iso: string) => void
  minDate?: string
  /** Data destacada como referência (ex.: emissão quando escolhendo validade) */
  referenceDate?: string
}

export function DateField({ id, value, onChange, minDate, referenceDate }: Props) {
  const [open, setOpen] = useState(false)
  // Data de referência fixada na montagem (não recalculada a cada renderização)
  const [today] = useState(() => new Date())
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = parseDate(value)
  const min = minDate ? parseDate(minDate) : undefined
  const ref = referenceDate ? parseDate(referenceDate) : undefined

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          inputClass,
          'flex items-center gap-2 text-left',
          open && 'border-brand-500 ring-3 ring-brand-100',
        )}
      >
        <CalendarDays size={16} className="shrink-0 text-slate-400" />
        {selected ? (
          <span className="truncate">
            <span className="font-medium tabular-nums">{format(selected, 'dd/MM/yyyy')}</span>
            <span className="ml-1.5 text-slate-400">{format(selected, 'EEE', { locale: dfPtBR })}</span>
          </span>
        ) : (
          <span className="text-slate-400">Selecionar data</span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Escolher data"
          className="absolute left-0 z-30 mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={selected}
            defaultMonth={selected ?? today}
            captionLayout="dropdown"
            startMonth={new Date(2015, 0)}
            endMonth={new Date(today.getFullYear() + 5, 11)}
            disabled={min ? { before: min } : undefined}
            modifiers={ref ? { reference: ref } : undefined}
            modifiersClassNames={{ reference: 'underline decoration-2 decoration-slate-300 underline-offset-4' }}
            onSelect={(d) => {
              if (d) {
                onChange(toISODate(d))
                setOpen(false)
              }
            }}
            autoFocus
          />
          <div className="mt-1 flex justify-end border-t border-slate-100 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange(toISODate(new Date()))
                setOpen(false)
              }}
            >
              Hoje
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
