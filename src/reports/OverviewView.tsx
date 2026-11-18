import { useMemo, useState } from 'react'
import { formatCurrency, formatPercent } from '../lib/format'
import { Segmented } from '../components/ui'
import { overviewReport, type MonthPoint } from './data'
import { DataTable, type Column } from './DataTable'
import { csvFromColumns } from './csv'
import { MonthlyChart } from './MonthlyChart'
import { CsvButton, Section, StatTile, type ViewProps } from './shared'

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

export function OverviewView({ ctx, filters }: ViewProps) {
  const r = useMemo(() => overviewReport(ctx, filters), [ctx, filters])
  const [mode, setMode] = useState<'grafico' | 'tabela'>('grafico')

  const monthColumns: Column<MonthPoint>[] = [
    {
      key: 'month',
      header: 'Mês',
      value: (m) => m.month,
      render: (m) => <span className="capitalize">{m.label}</span>,
    },
    { key: 'quotedCount', header: 'Enviados', value: (m) => m.quotedCount, align: 'right' },
    {
      key: 'quoted',
      header: 'Valor orçado',
      value: (m) => m.quoted,
      render: (m) => formatCurrency(m.quoted),
      align: 'right',
      footer: formatCurrency(r.series.reduce((a, m) => a + m.quoted, 0)),
    },
    { key: 'approvedCount', header: 'Aprovados', value: (m) => m.approvedCount, align: 'right' },
    {
      key: 'approved',
      header: 'Valor aprovado',
      value: (m) => m.approved,
      render: (m) => formatCurrency(m.approved),
      align: 'right',
      footer: formatCurrency(r.series.reduce((a, m) => a + m.approved, 0)),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Enviados"
          value={formatCurrency(r.sent.value)}
          sub={`${plural(r.sent.count, 'orçamento', 'orçamentos')} · ${r.created.count - r.sent.count} rascunho(s)`}
        />
        <StatTile
          label="Aprovados"
          tone="good"
          value={formatCurrency(r.approved.value)}
          sub={plural(r.approved.count, 'orçamento', 'orçamentos')}
        />
        <StatTile
          label="Taxa de aprovação"
          value={formatPercent(r.approvalRate)}
          sub={r.sent.count ? `${r.approved.count} de ${r.sent.count} enviados` : 'Nenhum enviado no período'}
        />
        <StatTile
          label="Ticket médio aprovado"
          value={r.avgTicket === null ? '—' : formatCurrency(r.avgTicket)}
          sub="valor médio por orçamento aprovado"
        />
        <StatTile
          label="Aguardando resposta"
          tone="warn"
          value={formatCurrency(r.open.value)}
          sub={`${plural(r.open.count, 'orçamento', 'orçamentos')} dentro da validade`}
        />
        <StatTile
          label="Vencidos sem resposta"
          tone={r.expired.count ? 'bad' : 'default'}
          value={formatCurrency(r.expired.value)}
          sub={plural(r.expired.count, 'orçamento', 'orçamentos')}
        />
        <StatTile
          label="Recusados"
          value={formatCurrency(r.refused.value)}
          sub={plural(r.refused.count, 'orçamento', 'orçamentos')}
        />
        <StatTile
          label="Tempo médio até aprovar"
          value={r.avgDaysToApprove === null ? '—' : plural(r.avgDaysToApprove, 'dia', 'dias')}
          sub="do envio à aprovação"
        />
      </div>

      <p className="text-xs text-slate-500">
        Os números acima consideram os orçamentos <strong>emitidos no período</strong> e o que aconteceu com eles.
        Fechados no período pela <strong>data de aprovação</strong>: {formatCurrency(r.approvedByDate.value)} (
        {plural(r.approvedByDate.count, 'orçamento', 'orçamentos')}).
      </p>

      <Section
        title="Evolução mensal"
        description="Orçado (enviados) por mês de emissão e aprovado por mês de aprovação"
        actions={
          <>
            <span className="print:hidden">
              <Segmented
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'grafico', label: 'Gráfico' },
                  { value: 'tabela', label: 'Tabela' },
                ]}
              />
            </span>
            <CsvButton filename="evolucao-mensal" build={() => csvFromColumns(monthColumns, r.series)} />
          </>
        }
      >
        {r.series.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Sem dados no período.</p>
        ) : mode === 'grafico' ? (
          <div className="p-5">
            <MonthlyChart data={r.series} />
          </div>
        ) : (
          <DataTable
            label="Evolução mensal"
            columns={monthColumns}
            rows={r.series}
            rowKey={(m) => m.month}
            initialSort={{ key: 'month', dir: 'asc' }}
          />
        )}
      </Section>
    </div>
  )
}
