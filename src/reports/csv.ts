import type { Column } from './DataTable'

/**
 * CSV no padrão do Excel em português: separador ";", decimal com vírgula e BOM UTF-8
 * (sem o BOM o Excel mostra acentos quebrados).
 */
export type CsvValue = string | number | null | undefined

function cell(v: CsvValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    return String(Math.round(v * 10000) / 10000).replace('.', ',')
  }
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

export function downloadCsv(filename: string, header: string[], rows: CsvValue[][]) {
  const blob = new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Monta o CSV a partir das colunas de uma tabela (ignora as marcadas como só de tela) */
export const csvFromColumns = <T>(columns: Column<T>[], rows: T[]) => {
  const cols = columns.filter((c) => !c.screenOnly)
  return {
    header: cols.map((c) => c.header),
    rows: rows.map((r) => cols.map((c) => (c.csv ? c.csv(r) : c.value(r)))),
  }
}
