import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui'
import { cn } from '../../../components/styles'

/**
 * Vitrine de recursos da landing: cada recurso mostra um pedaço da tela real (miniatura recortada), em blocos de
 * tamanhos diferentes. As miniaturas são decorativas (`aria-hidden`, dados de exemplo); o texto de cada recurso fica
 * fora do desenho, então leitores de tela e busca recebem o conteúdo completo.
 */

const ORCADO = '#2a78d6'
const APROVADO = '#eb6834'

/** Moldura de uma miniatura: fundo rebaixado e conteúdo cortado nas bordas, como uma captura de tela. */
function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden bg-slate-100 select-none', className)}>
      {children}
    </div>
  )
}

function Tile({
  title,
  text,
  children,
  className,
  wide,
}: {
  title: string
  text: string
  children: ReactNode
  className?: string
  /** Nos blocos largos o texto fica ao lado da miniatura (a partir de lg) */
  wide?: boolean
}) {
  return (
    <li className={cn('flex', className)}>
      <article
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white',
          wide && 'lg:flex-row',
        )}
      >
        <div className={cn('p-5 sm:p-6', wide && 'lg:w-5/12 lg:shrink-0')}>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
        </div>
        {children}
      </article>
    </li>
  )
}

const STATUS: Record<string, string> = {
  Aprovado: 'bg-emerald-50 text-emerald-700',
  Enviado: 'bg-amber-50 text-amber-700',
  Recusado: 'bg-red-50 text-red-700',
  Rascunho: 'bg-slate-100 text-slate-600',
}

function CatalogMock() {
  const found: [string, string, string][] = [
    ['Pintura de parede', 'm²', 'R$ 32,00'],
    ['Pintura de portão', 'un', 'R$ 180,00'],
    ['Pintura de teto', 'm²', 'R$ 38,00'],
  ]
  return (
    <Frame className="flex-1 border-t border-slate-200 p-5 lg:border-t-0 lg:border-l">
      <div className="mx-auto max-w-sm text-xs">
        <p className="mb-1 font-medium text-slate-500">Descrição do serviço</p>
        <div className="rounded-lg border border-brand-500 bg-white px-3 py-2.5 text-sm text-slate-900 ring-3 ring-brand-100">
          pintura
          <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-slate-900" />
        </div>
        <ul className="mt-1.5 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
          {found.map(([name, unit, price], i) => (
            <li
              key={name}
              className={cn('flex items-center justify-between gap-3 px-3 py-2.5', i === 0 && 'bg-brand-50')}
            >
              <span className="text-slate-800">{name}</span>
              <span className="tabular-nums text-slate-500">
                {unit} · <strong className="font-semibold text-slate-900">{price}</strong>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-[1fr_3.5rem_5rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <span className="truncate text-slate-800">Pintura de parede</span>
          <span className="text-right tabular-nums text-slate-600">18 m²</span>
          <span className="text-right font-semibold tabular-nums text-slate-900">R$ 576,00</span>
        </div>
      </div>
    </Frame>
  )
}

function PdfMock() {
  const rows: [string, string][] = [
    ['Instalação de ponto elétrico', '280,00'],
    ['Troca de disjuntor (2×)', '190,00'],
    ['Mão de obra', '450,00'],
  ]
  return (
    <Frame className="min-h-72 flex-1 border-t border-slate-200 px-6 pt-6">
      {/* Folha que continua para baixo: o recorte sugere o documento inteiro */}
      <div className="mx-auto h-[26rem] max-w-xs rounded-t-md bg-white p-5 text-[11px] shadow-lg ring-1 ring-slate-900/5">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Elétrica Silva</p>
            <p className="text-slate-500">CNPJ 12.345.678/0001-90</p>
          </div>
          <div className="text-right">
            <p className="font-semibold tracking-wide text-slate-500">ORÇAMENTO</p>
            <p className="font-mono text-slate-900">ORC-0042</p>
          </div>
        </div>
        <p className="mt-3 text-slate-500">Cliente</p>
        <p className="font-medium text-slate-900">Marina Souza</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map(([name, value]) => (
            <li key={name} className="flex justify-between gap-2 py-1.5">
              <span className="text-slate-700">{name}</span>
              <span className="tabular-nums text-slate-900">R$ {value}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-slate-900 pt-2">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="text-base font-bold tabular-nums text-slate-900">R$ 920,00</span>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="h-1.5 w-1/3 rounded bg-slate-200" />
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-4/5 rounded bg-slate-100" />
        </div>
      </div>
    </Frame>
  )
}

function ReportsMock() {
  // [orçado, aprovado] por mês, em % da altura
  const months: [string, number, number][] = [
    ['Jun', 48, 30],
    ['Jul', 62, 38],
    ['Ago', 40, 28],
    ['Set', 78, 52],
    ['Out', 70, 55],
    ['Nov', 92, 61],
  ]
  return (
    <Frame className="flex-1 border-t border-slate-200 p-5 lg:border-t-0 lg:border-l">
      <div className="mx-auto max-w-md space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Orçado', 'R$ 48.200'],
            ['Aprovado', 'R$ 31.900'],
            ['Aprovação', '68%'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-slate-500">{label}</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 pt-3 pb-2">
          <div className="flex h-24 items-end gap-3">
            {months.map(([m, a, b]) => (
              <div key={m} className="flex h-full flex-1 items-end justify-center gap-1">
                <span className="w-2.5 rounded-t-sm" style={{ height: `${a}%`, background: ORCADO }} />
                <span className="w-2.5 rounded-t-sm" style={{ height: `${b}%`, background: APROVADO }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-3 text-slate-500">
            {months.map(([m]) => (
              <span key={m} className="flex-1 text-center">
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-amber-900">
            <strong>2 orçamentos</strong> vencem nos próximos 7 dias
          </span>
          <span className="rounded-md bg-white px-2 py-1 font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
            Cobrar
          </span>
        </div>
      </div>
    </Frame>
  )
}

function ClientMock() {
  const quotes: [string, string, string, string][] = [
    ['ORC-0042', 'Reforma elétrica', 'R$ 920,00', 'Aprovado'],
    ['ORC-0037', 'Troca de fiação', 'R$ 1.480,00', 'Enviado'],
    ['ORC-0021', 'Tomadas da sala', 'R$ 310,00', 'Aprovado'],
  ]
  return (
    <Frame className="flex-1 border-t border-slate-200 p-5">
      <div className="mx-auto max-w-xs rounded-lg border border-slate-200 bg-white text-xs shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            M
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Marina Souza</p>
            <p className="text-slate-500">(11) 91234-5678</p>
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {quotes.map(([num, name, value, status]) => (
            <li key={num} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-slate-800">{name}</p>
                <p className="font-mono text-[10px] text-slate-400">{num}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="tabular-nums text-slate-900">{value}</span>
                <Badge className={cn('px-1.5 py-0 text-[10px]', STATUS[status])}>{status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}

function CompaniesMock() {
  const list: [string, string, string, boolean][] = [
    ['E', 'Elétrica Silva', 'Próximo: ORC-0043', true],
    ['H', 'Hidráulica Silva', 'Próximo: ORC-0008', false],
  ]
  return (
    <Frame className="flex flex-1 items-center border-t border-slate-200 p-5">
      <ul className="mx-auto w-full max-w-xs space-y-2 text-xs">
        {list.map(([letter, name, next, active]) => (
          <li
            key={name}
            className={cn(
              'flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5',
              active ? 'border-brand-500 shadow-sm ring-3 ring-brand-100' : 'border-slate-200',
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
              {letter}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{name}</p>
              <p className="font-mono text-slate-500">{next}</p>
            </div>
            {active && <Badge className="bg-brand-50 text-brand-700">Ativa</Badge>}
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function PhoneMock() {
  return (
    <Frame className="flex-1 border-t border-slate-200 px-5 pt-5">
      <div className="mx-auto w-44 rounded-t-[1.6rem] border-[5px] border-b-0 border-slate-800 bg-white pb-16 text-[10px]">
        <div className="mx-auto mt-1.5 h-1 w-10 rounded-full bg-slate-200" />
        <div className="space-y-2 p-3">
          <p className="text-xs font-semibold text-slate-900">
            Orçamento <span className="font-mono text-slate-500">ORC-0043</span>
          </p>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            Rascunho
          </span>
          <div className="rounded-md border border-slate-200 p-2">
            <p className="text-slate-800">Pintura de parede</p>
            <p className="tabular-nums text-slate-500">18 m² × R$ 32,00</p>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 p-2 text-center text-slate-400">
            + Adicionar item
          </div>
        </div>
      </div>
      {/* Barra de total fixa, como no app */}
      <div className="absolute inset-x-0 bottom-0 mx-auto flex w-44 items-center justify-between border-x-[5px] border-slate-800 bg-white px-3 py-2 text-[10px] shadow-[0_-4px_8px_rgba(0,0,0,0.06)]">
        <div>
          <p className="text-slate-500">Total</p>
          <p className="text-xs font-bold tabular-nums text-slate-900">R$ 576,00</p>
        </div>
        <span className="rounded-md bg-brand-600 px-2 py-1.5 font-medium text-white">Baixar PDF</span>
      </div>
    </Frame>
  )
}

export function Showcase() {
  return (
    <>
      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Tile
          wide
          className="md:col-span-2 lg:col-span-4"
          title="Orçamento em poucos toques"
          text="Cadastre seu catálogo de serviços e preços uma vez. Na hora de orçar, digite o início do nome, escolha e informe a quantidade: o total, com desconto e acréscimos, sai na hora."
        >
          <CatalogMock />
        </Tile>
        <Tile
          className="md:col-span-2 lg:col-span-2 lg:row-span-2"
          title="PDF com a sua cara"
          text="Os dados da sua empresa, os itens, as condições e a validade, num documento limpo para enviar por WhatsApp ou e-mail."
        >
          <PdfMock />
        </Tile>
        <Tile
          wide
          className="md:col-span-2 lg:col-span-4"
          title="Saiba quanto fechou e quem cobrar"
          text="Veja o que foi orçado e aprovado mês a mês e quais orçamentos estão para vencer. Um toque abre o WhatsApp com a mensagem de cobrança pronta."
        >
          <ReportsMock />
        </Tile>
        <Tile
          className="lg:col-span-2"
          title="Clientes organizados"
          text="Cada cliente guarda os contatos e o histórico de todos os orçamentos feitos para ele."
        >
          <ClientMock />
        </Tile>
        <Tile
          className="lg:col-span-2"
          title="Mais de uma empresa"
          text="Atende com mais de um CNPJ ou nome? Cada empresa tem a sua identidade e a sua própria numeração."
        >
          <CompaniesMock />
        </Tile>
        <Tile
          className="md:col-span-2 lg:col-span-2"
          title="Feito para o celular"
          text="Monte o orçamento na casa do cliente, na hora, sem precisar de computador."
        >
          <PhoneMock />
        </Tile>
      </ul>
      <p className="mt-4 text-xs text-slate-400">Telas ilustrativas, com dados de exemplo.</p>
    </>
  )
}
