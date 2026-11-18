import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import type { CompanyProfile } from '../types'
import { Button, Card } from '../components/ui'
import { cn } from '../components/styles'
import type { ReportContext, ReportFilters } from './data'
import { downloadCsv, type CsvValue } from './csv'

export interface ViewProps {
  ctx: ReportContext
  filters: ReportFilters
  profiles: CompanyProfile[]
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: 'text-slate-900',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[tone]
  return (
    <Card className="break-inside-avoid p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', toneClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  )
}

export function CsvButton({
  filename,
  build,
  label = 'Exportar CSV',
}: {
  filename: string
  build: () => { header: string[]; rows: CsvValue[][] }
  label?: string
}) {
  return (
    <Button
      size="sm"
      className="print:hidden"
      onClick={() => {
        const { header, rows } = build()
        downloadCsv(`${filename}-${new Date().toISOString().slice(0, 10)}`, header, rows)
      }}
    >
      <Download size={14} /> {label}
    </Button>
  )
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}
