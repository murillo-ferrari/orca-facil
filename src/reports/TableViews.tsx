import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import { STATUS } from '../lib/status'
import { Badge, cn } from '../components/ui'
import {
  clientsReport,
  discountsReport,
  servicesReport,
  type ClientRow,
  type DiscountRow,
  type ServiceRow,
} from './data'
import { DataTable, csvFromColumns, type Column } from './DataTable'
import { CsvButton, Section, StatTile, formatPercent, type ViewProps } from './shared'

const money = (v: number | null) => (v === null ? '—' : formatCurrency(v))
const sumBy = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0)

/* ------------------------------------------------------------------ */

export function ClientsView({ ctx, filters }: ViewProps) {
  const navigate = useNavigate()
  const rows = useMemo(() => clientsReport(ctx, filters), [ctx, filters])

  const columns: Column<ClientRow>[] = [
    {
      key: 'name',
      header: 'Cliente',
      value: (r) => r.name,
      className: 'whitespace-nowrap',
      render: (r) => (
        <span className="font-medium text-slate-900">
          {r.name}
          {!r.clientId && <span className="ml-1.5 text-xs font-normal text-slate-400">(sem cadastro)</span>}
        </span>
      ),
    },
    { key: 'count', header: 'Orçamentos', value: (r) => r.count, align: 'right', footer: sumBy(rows, (r) => r.count) },
    { key: 'sent', header: 'Enviados', value: (r) => r.sent, align: 'right', footer: sumBy(rows, (r) => r.sent) },
    {
      key: 'approved',
      header: 'Aprovados',
      value: (r) => r.approved,
      align: 'right',
      footer: sumBy(rows, (r) => r.approved),
    },
    {
      key: 'rate',
      header: 'Taxa',
      value: (r) => r.approvalRate,
      render: (r) => formatPercent(r.approvalRate),
      csv: (r) => (r.approvalRate === null ? '' : formatPercent(r.approvalRate)),
      align: 'right',
    },
    {
      key: 'quotedValue',
      header: 'Valor orçado',
      value: (r) => r.quotedValue,
      render: (r) => money(r.quotedValue),
      align: 'right',
      footer: money(sumBy(rows, (r) => r.quotedValue)),
    },
    {
      key: 'approvedValue',
      header: 'Valor aprovado',
      value: (r) => r.approvedValue,
      render: (r) => <span className="font-semibold">{money(r.approvedValue)}</span>,
      align: 'right',
      footer: money(sumBy(rows, (r) => r.approvedValue)),
    },
    {
      key: 'avgTicket',
      header: 'Ticket médio',
      value: (r) => r.avgTicket,
      render: (r) => money(r.avgTicket),
      align: 'right',
    },
    {
      key: 'lastIssue',
      header: 'Último',
      value: (r) => r.lastIssue,
      render: (r) => formatDate(r.lastIssue),
      csv: (r) => formatDate(r.lastIssue),
      align: 'right',
    },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clientes com orçamentos" value={rows.length} />
        <StatTile label="Clientes que aprovaram" tone="good" value={rows.filter((r) => r.approved > 0).length} />
        <StatTile
          label="Maior cliente (aprovado)"
          value={
            <span className="block truncate text-base">
              {[...rows].sort((a, b) => b.approvedValue - a.approvedValue)[0]?.approvedValue
                ? [...rows].sort((a, b) => b.approvedValue - a.approvedValue)[0].name
                : '—'}
            </span>
          }
          sub={money([...rows].sort((a, b) => b.approvedValue - a.approvedValue)[0]?.approvedValue ?? null)}
        />
        <StatTile
          label="Clientes recorrentes"
          value={rows.filter((r) => r.approved >= 2).length}
          sub="com 2 ou mais aprovações"
        />
      </div>
      <Section
        title="Ranking de clientes"
        description="Orçamentos emitidos no período. Clique para abrir o histórico do cliente."
        actions={<CsvButton filename="clientes" build={() => csvFromColumns(columns, rows)} />}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          initialSort={{ key: 'approvedValue', dir: 'desc' }}
          onRowClick={(r) => r.clientId && navigate(`/clientes/${r.clientId}`)}
        />
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function ServicesView({ ctx, filters }: ViewProps) {
  const rows = useMemo(() => servicesReport(ctx, filters), [ctx, filters])

  const columns: Column<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Serviço',
      value: (r) => r.name,
      className: 'whitespace-nowrap',
      render: (r) => (
        <span className="font-medium text-slate-900">
          {r.name}
          {r.inCatalog && <Badge className="ml-1.5 bg-brand-50 text-brand-700">catálogo</Badge>}
        </span>
      ),
    },
    { key: 'unit', header: 'Un', value: (r) => r.unit, align: 'center' },
    { key: 'quotes', header: 'Orçam.', value: (r) => r.quotes, align: 'right' },
    {
      key: 'quotedValue',
      header: 'Valor orçado',
      value: (r) => r.quotedValue,
      render: (r) => money(r.quotedValue),
      align: 'right',
      footer: money(sumBy(rows, (r) => r.quotedValue)),
    },
    {
      key: 'approvedValue',
      header: 'Valor aprovado',
      value: (r) => r.approvedValue,
      render: (r) => <span className="font-semibold">{money(r.approvedValue)}</span>,
      align: 'right',
      footer: money(sumBy(rows, (r) => r.approvedValue)),
    },
    {
      key: 'avgPrice',
      header: 'Preço médio',
      value: (r) => r.avgPrice,
      render: (r) => money(r.avgPrice),
      align: 'right',
    },
    {
      key: 'catalogPrice',
      header: 'Preço catálogo',
      value: (r) => r.catalogPrice,
      csvOnly: true,
    },
    {
      key: 'priceDiff',
      header: 'Dif. vs. catálogo',
      value: (r) => r.priceDiff,
      csv: (r) => (r.priceDiff === null ? '' : formatPercent(r.priceDiff)),
      render: (r) =>
        r.priceDiff === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span title={`Preço de catálogo: ${money(r.catalogPrice)}`}>
            <span
              className={cn(
                'font-medium',
                Math.abs(r.priceDiff) < 0.005
                  ? 'text-slate-500'
                  : r.priceDiff < 0
                    ? 'text-red-600'
                    : 'text-emerald-600',
              )}
            >
              {r.priceDiff > 0 ? '+' : ''}
              {formatPercent(r.priceDiff)}
            </span>
            <span className="block text-xs text-slate-400">cat. {money(r.catalogPrice)}</span>
          </span>
        ),
      align: 'right',
    },
    {
      key: 'qty',
      header: 'Qtd aprov./orç.',
      value: (r) => r.qtyApproved,
      screenOnly: true,
      render: (r) => (
        <span className="text-slate-600">
          {formatNumber(r.qtyApproved)} / {formatNumber(r.qtyQuoted)}
        </span>
      ),
      align: 'right',
    },
    { key: 'qtyQuoted', header: 'Qtd orçada', value: (r) => r.qtyQuoted, csvOnly: true },
    { key: 'qtyApproved', header: 'Qtd aprovada', value: (r) => r.qtyApproved, csvOnly: true },
  ]

  const top = [...rows].sort((a, b) => b.approvedValue - a.approvedValue)[0]
  const belowCatalog = rows.filter((r) => r.priceDiff !== null && r.priceDiff < -0.005)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Serviços orçados" value={rows.length} />
        <StatTile
          label="Mais vendido (valor)"
          value={<span className="block truncate text-base">{top?.approvedValue ? top.name : '—'}</span>}
          sub={top?.approvedValue ? money(top.approvedValue) : undefined}
        />
        <StatTile
          label="Mais orçado (vezes)"
          value={
            <span className="block truncate text-base">
              {[...rows].sort((a, b) => b.quotes - a.quotes)[0]?.name ?? '—'}
            </span>
          }
          sub={rows.length ? `${[...rows].sort((a, b) => b.quotes - a.quotes)[0].quotes} orçamento(s)` : undefined}
        />
        <StatTile
          label="Abaixo do preço de catálogo"
          tone={belowCatalog.length ? 'warn' : 'default'}
          value={belowCatalog.length}
          sub="serviços com preço médio menor"
        />
      </div>
      <Section
        title="Serviços"
        description="Orçamentos enviados no período. Valores dos itens antes de descontos e acréscimos."
        actions={<CsvButton filename="servicos" build={() => csvFromColumns(columns, rows)} />}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          initialSort={{ key: 'approvedValue', dir: 'desc' }}
        />
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function DiscountsView({ ctx, filters }: ViewProps) {
  const navigate = useNavigate()
  const r = useMemo(() => discountsReport(ctx, filters), [ctx, filters])

  const quoteColumns: Column<DiscountRow>[] = [
    {
      key: 'number',
      header: 'Número',
      value: (x) => x.quote.number,
      render: (x) => <span className="font-mono text-xs">{x.quote.number}</span>,
    },
    { key: 'client', header: 'Cliente', value: (x) => x.clientName, className: 'whitespace-nowrap' },
    {
      key: 'issue',
      header: 'Emissão',
      value: (x) => x.quote.issueDate,
      render: (x) => formatDate(x.quote.issueDate),
      csv: (x) => formatDate(x.quote.issueDate),
    },
    {
      key: 'status',
      header: 'Status',
      value: (x) => STATUS[x.quote.status].label,
      render: (x) => <Badge className={STATUS[x.quote.status].className}>{STATUS[x.quote.status].label}</Badge>,
    },
    { key: 'subtotal', header: 'Subtotal', value: (x) => x.subtotal, render: (x) => money(x.subtotal), align: 'right' },
    {
      key: 'discount',
      header: 'Desconto',
      value: (x) => x.discount,
      render: (x) => <span className="font-semibold">{money(x.discount)}</span>,
      align: 'right',
      footer: money(r.totalDiscount),
    },
    {
      key: 'percent',
      header: '%',
      value: (x) => x.percent,
      render: (x) => formatPercent(x.percent),
      csv: (x) => formatPercent(x.percent),
      align: 'right',
    },
    { key: 'total', header: 'Total', value: (x) => x.total, render: (x) => money(x.total), align: 'right' },
  ]

  type ByClient = (typeof r.byClient)[number]
  const clientColumns: Column<ByClient>[] = [
    { key: 'name', header: 'Cliente', value: (c) => c.name, className: 'whitespace-nowrap' },
    { key: 'count', header: 'Orçamentos c/ desconto', value: (c) => c.count, align: 'right' },
    {
      key: 'discount',
      header: 'Desconto total',
      value: (c) => c.discount,
      render: (c) => money(c.discount),
      align: 'right',
    },
    {
      key: 'percent',
      header: '% médio',
      value: (c) => c.percent,
      render: (c) => formatPercent(c.percent),
      csv: (c) => formatPercent(c.percent),
      align: 'right',
    },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Desconto concedido"
          tone={r.totalDiscount ? 'warn' : 'default'}
          value={money(r.totalDiscount)}
          sub="em orçamentos enviados"
        />
        <StatTile
          label="Em orçamentos aprovados"
          value={money(r.approvedDiscount)}
          sub="desconto que de fato saiu do caixa"
        />
        <StatTile
          label="Desconto médio"
          value={formatPercent(r.avgPercent)}
          sub="sobre o subtotal, quando há desconto"
        />
        <StatTile
          label="Orçamentos com desconto"
          value={`${r.rows.length} de ${r.sentCount}`}
          sub={r.sentCount ? formatPercent(r.rows.length / r.sentCount) + ' dos enviados' : undefined}
        />
      </div>
      <Section
        title="Orçamentos com desconto"
        description="Enviados no período"
        actions={<CsvButton filename="descontos" build={() => csvFromColumns(quoteColumns, r.rows)} />}
      >
        <DataTable
          columns={quoteColumns}
          rows={r.rows}
          rowKey={(x) => x.quote.id}
          initialSort={{ key: 'discount', dir: 'desc' }}
          onRowClick={(x) => navigate(`/orcamentos/${x.quote.id}`)}
          empty="Nenhum orçamento com desconto para os filtros selecionados."
        />
      </Section>
      <Section
        title="Descontos por cliente"
        actions={<CsvButton filename="descontos-por-cliente" build={() => csvFromColumns(clientColumns, r.byClient)} />}
      >
        <DataTable
          columns={clientColumns}
          rows={r.byClient}
          rowKey={(c) => c.key}
          initialSort={{ key: 'discount', dir: 'desc' }}
          empty="Nenhum desconto concedido no período."
        />
      </Section>
    </div>
  )
}
