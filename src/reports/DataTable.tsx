import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '../components/styles'
import type { CsvValue } from './csv'

export interface Column<T> {
  key: string
  header: string
  /** Valor usado para ordenar e exportar */
  value: (row: T) => string | number | null
  /** Renderização na tela (padrão: o próprio valor) */
  render?: (row: T) => ReactNode
  /** Valor no CSV quando diferente do usado para ordenar */
  csv?: (row: T) => CsvValue
  align?: 'left' | 'right' | 'center'
  /** Rodapé (ex.: soma da coluna) */
  footer?: ReactNode
  className?: string
  /** Só no CSV (não aparece na tabela) */
  csvOnly?: boolean
  /** Só na tela (não vai para o CSV) */
  screenOnly?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  onRowClick,
  empty = 'Nenhum dado para os filtros selecionados.',
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  onRowClick?: (row: T) => void
  empty?: ReactNode
}) {
  const visible = columns.filter((c) => !c.csvOnly)
  const [sort, setSort] = useState(initialSort ?? { key: visible[0].key, dir: 'asc' as const })

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.value(a)
      const vb = col.value(b)
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'pt-BR') * dir
    })
  }, [rows, columns, sort])

  const hasFooter = visible.some((c) => c.footer !== undefined)
  const alignClass = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {visible.map((c) => {
              const active = sort.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn('px-3 py-2 first:pl-5 last:pr-5', alignClass(c.align))}
                >
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase print:pointer-events-none',
                      active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800',
                      c.align === 'right' && 'flex-row-reverse',
                    )}
                    onClick={() =>
                      setSort((s) =>
                        s.key === c.key
                          ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                          : { key: c.key, dir: typeof c.value(rows[0]) === 'number' ? 'desc' : 'asc' },
                      )
                    }
                  >
                    {c.header}
                    <span className="print:hidden">
                      {active ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-40" />
                      )}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn(onRowClick && 'cursor-pointer hover:bg-slate-50', 'break-inside-avoid')}
            >
              {visible.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-2.5 first:pl-5 last:pr-5',
                    alignClass(c.align),
                    c.align === 'right' && 'tabular-nums whitespace-nowrap',
                    c.className,
                  )}
                >
                  {c.render ? c.render(r) : c.value(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasFooter && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-semibold text-slate-900">
              {visible.map((c) => (
                <td
                  key={c.key}
                  className={cn('px-3 py-2.5 first:pl-5 last:pr-5 tabular-nums whitespace-nowrap', alignClass(c.align))}
                >
                  {c.footer}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
