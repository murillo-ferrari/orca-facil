import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Crown, ExternalLink, Minus } from 'lucide-react'
import { Badge, Button, Card, PageHeader, Segmented } from '../../../components/ui'
import { cn } from '../../../components/styles'
import { formatCurrency } from '../../../lib/format'
import { confirmSubscription, subscribe, usePlan, watchPlan, type Interval } from './planStore'

/** Linhas da comparação: [recurso, Grátis, Pro]. true/false viram ícone; texto aparece como está. */
const FEATURES: [string, string | boolean, string | boolean][] = [
  ['Orçamentos novos por mês', '15', 'Ilimitados'],
  ['Empresas (perfis)', '1', 'Ilimitadas'],
  ['Sincronização entre celular e computador', true, true],
  ['Funciona sem internet', true, true],
  ['PDF, clientes, catálogo de serviços', true, true],
  ['Relatórios e follow-up', true, true],
  ['Importar dados da edição Local', true, true],
]

const FAQ: [string, string][] = [
  [
    'Como funciona o pagamento?',
    'A assinatura é feita pelo Mercado Pago e renova sozinha a cada mês ou ano, conforme o período escolhido. O Orçafácil não vê nem guarda os dados do seu pagamento.',
  ],
  [
    'Posso cancelar quando quiser?',
    'Sim, em Ajustes › Plano. O Pro continua valendo até o fim do período já pago; depois, a conta volta ao plano grátis.',
  ],
  [
    'O que acontece com meus dados se eu voltar ao grátis?',
    'Nada é apagado. Você continua vendo e editando tudo; só a criação de orçamentos e empresas acima do limite do grátis fica bloqueada.',
  ],
  [
    'Orçamentos importados da edição Local contam no limite?',
    'Não. O limite vale só para orçamentos novos criados no mês.',
  ],
]

function Value({ v, label }: { v: string | boolean; label: string }) {
  if (typeof v === 'string') return <span className="font-medium text-slate-900">{v}</span>
  return v ? (
    <Check size={18} className="text-emerald-600" role="img" aria-label={`${label}: incluído`} />
  ) : (
    <Minus size={18} className="text-slate-300" role="img" aria-label={`${label}: não incluído`} />
  )
}

/** /assinatura (edição Cloud): benefícios do Pro, comparação com o grátis, preços e perguntas frequentes. */
export default function SubscriptionPage() {
  const { loaded, view, prices, use, busy } = usePlan()
  const [interval, setInterval] = useState<Interval>('anual')
  useEffect(watchPlan, [])

  const monthly = prices.mensal
  const yearly = prices.anual
  const saving = monthly && yearly ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0
  const price = interval === 'anual' ? yearly : monthly

  return (
    <>
      <PageHeader
        title="Orçafácil Pro"
        description="Para quem vive de orçamento: sem limite de orçamentos nem de empresas."
      />

      {loaded && view.pro && (
        <Card className="mb-6 border-brand-200 bg-brand-50">
          <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5" role="status">
            <Crown size={20} className="text-brand-700" aria-hidden />
            <p className="flex-1 text-sm text-slate-800">
              <strong>Você já é {view.title}.</strong> {view.detail}
            </p>
            <Link to="/config" className="text-sm font-medium text-brand-700 underline">
              Gerenciar em Ajustes
            </Link>
          </div>
        </Card>
      )}

      <div className="mb-5 flex justify-center">
        <Segmented<Interval>
          ariaLabel="Período de cobrança"
          value={interval}
          onChange={setInterval}
          options={[
            { value: 'mensal', label: 'Mensal' },
            { value: 'anual', label: `Anual${saving > 0 ? ` (economize ${saving}%)` : ''}` },
          ]}
        />
      </div>

      {/* Cards lado a lado no computador, empilhados no celular (Pro primeiro: é o que a página oferece) */}
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        <Card className="order-2 md:order-1">
          <div className="flex h-full flex-col gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Grátis</h2>
              <p className="text-sm text-slate-500">Para quem orça de vez em quando.</p>
            </div>
            <p>
              <span className="text-3xl font-bold tracking-tight text-slate-900">R$ 0</span>
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> 15 orçamentos novos por mês
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> 1 empresa
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Todos os recursos do app
              </li>
            </ul>
            {loaded && !view.pro && use?.limite_orcamentos_no_mes != null && (
              <p className="mt-auto text-xs text-slate-500">
                Seu uso neste mês: {use.orcamentos_no_mes} de {use.limite_orcamentos_no_mes} orçamentos.
              </p>
            )}
          </div>
        </Card>

        <Card className="relative order-1 border-2 border-brand-500 md:order-2">
          <div className="flex h-full flex-col gap-4 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Crown size={18} className="text-brand-600" aria-hidden /> Pro
                <Badge className="bg-brand-50 text-brand-700">Sem limites</Badge>
              </h2>
              <p className="text-sm text-slate-500">Para quem vive de orçamento.</p>
            </div>
            <p className={cn(!price && 'invisible')}>
              <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatCurrency(price ?? 0)}
              </span>
              <span className="text-sm text-slate-500">{interval === 'anual' ? '/ano' : '/mês'}</span>
              {interval === 'anual' && yearly && (
                <span className="block text-xs text-slate-500">Equivale a {formatCurrency(yearly / 12)} por mês</span>
              )}
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong>Orçamentos ilimitados</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong>Empresas ilimitadas</strong>, cada uma com sua numeração
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Todos os recursos do grátis
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Cancele quando quiser
              </li>
            </ul>
            <div className="mt-auto space-y-2 pt-2">
              {loaded && view.pro ? (
                <p className="text-center text-sm font-medium text-brand-700">Este é o seu plano</p>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  onClick={() => void subscribe(interval)}
                  disabled={busy || !loaded || !price}
                >
                  <ExternalLink size={18} aria-hidden /> {busy ? 'Aguarde…' : 'Assinar o Pro'}
                </Button>
              )}
              <p className="text-center text-xs text-slate-500">Pagamento seguro pelo Mercado Pago.</p>
            </div>
          </div>
        </Card>
      </div>

      <section className="mx-auto mt-10 max-w-3xl" aria-labelledby="comparacao">
        <h2 id="comparacao" className="mb-3 text-lg font-semibold text-slate-900">
          Comparação
        </h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-4 py-3 sm:px-5">
                  Recurso
                </th>
                <th scope="col" className="w-24 px-2 py-3 text-center sm:w-32">
                  Grátis
                </th>
                <th scope="col" className="w-24 px-2 py-3 text-center text-brand-700 sm:w-32">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FEATURES.map(([label, free, pro]) => (
                <tr key={label}>
                  <th scope="row" className="px-4 py-3 text-left font-normal text-slate-700 sm:px-5">
                    {label}
                  </th>
                  <td className="px-2 py-3 text-center">
                    <span className="inline-flex justify-center">
                      <Value v={free} label={`${label}, grátis`} />
                    </span>
                  </td>
                  <td className="bg-brand-50/40 px-2 py-3 text-center">
                    <span className="inline-flex justify-center">
                      <Value v={pro} label={`${label}, Pro`} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mx-auto mt-10 max-w-3xl" aria-labelledby="perguntas">
        <h2 id="perguntas" className="mb-3 text-lg font-semibold text-slate-900">
          Perguntas frequentes
        </h2>
        <Card className="divide-y divide-slate-100">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-4 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-3.5 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {/* Seta antes do texto, girada quando fechado (guia "accordion" do MWG) */}
                <ChevronDown
                  size={16}
                  aria-hidden
                  className="shrink-0 -rotate-90 text-slate-400 group-open:rotate-0 motion-safe:transition-transform"
                />
                {q}
              </summary>
              <p className="pb-4 pl-6 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </Card>
      </section>

      {loaded && !view.pro && (
        <p className="mt-8 text-center text-sm text-slate-500">
          Já pagou e o plano não mudou?{' '}
          <button
            type="button"
            className="font-medium text-brand-700 underline disabled:opacity-60"
            onClick={() => void confirmSubscription()}
            disabled={busy}
          >
            Verificar assinatura
          </button>
        </p>
      )}
    </>
  )
}
