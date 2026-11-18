import { useId, useState } from 'react'
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { CompanyProfile, QuoteStatus } from '../types'
import { STATUS, STATUS_ORDER } from '../lib/status'
import { DateField } from '../components/DateField'
import { NumberInput } from '../components/NumberInput'
import { Button, Card, Field, Select } from '../components/ui'
import { cn } from '../components/styles'
import { PERIOD_LABELS, periodRange, type Option, type PeriodPreset, type ReportFilters } from './data'
import { profileName, type FilterAvailability } from './describeFilters'

export function FilterBar({
  filters: f,
  onChange,
  profiles,
  options,
  availability = {},
  onReset,
}: {
  filters: ReportFilters
  onChange: (f: ReportFilters) => void
  profiles: CompanyProfile[]
  options: { clients: Option[]; services: Option[] }
  availability?: FilterAvailability
  onReset: () => void
}) {
  const ids = { profile: useId(), period: useId(), client: useId(), service: useId() }
  const set = (patch: Partial<ReportFilters>) => onChange({ ...f, ...patch })
  // No celular os filtros ficam recolhidos para os dados aparecerem primeiro
  const [open, setOpen] = useState(false)
  const activeCount =
    (f.preset !== '12m' && !availability.period ? 1 : 0) +
    (f.statuses.length && !availability.status ? 1 : 0) +
    (f.clientKey ? 1 : 0) +
    (f.serviceKey ? 1 : 0) +
    (f.minValue !== null ? 1 : 0) +
    (f.maxValue !== null ? 1 : 0)
  const toggleStatus = (s: QuoteStatus) =>
    set({ statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s] })

  const disabledHint = (reason: string | false | undefined) =>
    reason ? <span className="font-normal text-slate-400"> · {reason}</span> : null

  return (
    <Card className="mb-5 p-4 print:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium text-slate-700 sm:hidden"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-slate-400" /> Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{activeCount}</span>
          )}
        </span>
        <ChevronDown size={16} className={cn('text-slate-400 motion-safe:transition', open && 'rotate-180')} />
      </button>
      <div className={cn(open ? 'mt-3 block' : 'hidden', 'sm:mt-0 sm:block')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Empresa" htmlFor={ids.profile}>
            <Select
              id={ids.profile}
              value={f.profileId}
              onChange={(e) => set({ profileId: e.target.value, clientKey: '', serviceKey: '' })}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {profileName(p)}
                </option>
              ))}
              {profiles.length > 1 && <option value="">Todas as empresas</option>}
            </Select>
          </Field>

          <Field label={<>Período de emissão{disabledHint(availability.period)}</>} htmlFor={ids.period}>
            <Select
              id={ids.period}
              value={f.preset}
              disabled={!!availability.period}
              onChange={(e) => {
                const preset = e.target.value as PeriodPreset
                // Ao escolher "Personalizado", parte do intervalo que estava selecionado
                if (preset === 'custom' && f.preset !== 'custom') {
                  const r = periodRange(f)
                  set({ preset, from: r.from ?? '', to: r.to ?? '' })
                } else set({ preset })
              }}
            >
              {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((k) => (
                <option key={k} value={k}>
                  {PERIOD_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cliente" htmlFor={ids.client}>
            <Select id={ids.client} value={f.clientKey} onChange={(e) => set({ clientKey: e.target.value })}>
              <option value="">Todos os clientes</option>
              {options.clients.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Serviço" htmlFor={ids.service}>
            <Select id={ids.service} value={f.serviceKey} onChange={(e) => set({ serviceKey: e.target.value })}>
              <option value="">Todos os serviços</option>
              {options.services.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          {f.preset === 'custom' && !availability.period && (
            <>
              <Field label="De">
                <DateField value={f.from} onChange={(from) => set({ from })} />
              </Field>
              <Field label="Até">
                <DateField value={f.to} minDate={f.from || undefined} onChange={(to) => set({ to })} />
              </Field>
            </>
          )}

          <Field label="Valor do orçamento — mínimo">
            <NumberInput
              currency
              value={f.minValue ?? 0}
              onValueChange={(v) => set({ minValue: v > 0 ? v : null })}
              placeholder="Sem mínimo"
            />
          </Field>
          <Field label="Valor do orçamento — máximo">
            <NumberInput currency value={f.maxValue ?? 0} onValueChange={(v) => set({ maxValue: v > 0 ? v : null })} />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Status{disabledHint(availability.status)}</span>
          {STATUS_ORDER.map((s) => {
            const on = f.statuses.includes(s)
            return (
              <button
                key={s}
                type="button"
                disabled={!!availability.status}
                aria-pressed={on}
                onClick={() => toggleStatus(s)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-40',
                  on
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                {STATUS[s].label}
              </button>
            )
          })}
          {!f.statuses.length && !availability.status && <span className="text-xs text-slate-400">(todos)</span>}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onReset}>
            <RotateCcw size={14} /> Limpar filtros
          </Button>
        </div>
      </div>
    </Card>
  )
}
