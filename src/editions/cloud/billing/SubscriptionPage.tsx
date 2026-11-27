import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Crown, ExternalLink, Minus } from 'lucide-react'
import { Badge, Button, Card, PageHeader, Segmented } from '../../../components/ui'
import { Faq } from '../../../components/Faq'
import { cn } from '../../../components/styles'
import { formatCurrency } from '../../../lib/format'
import { confirmSubscription, subscribe, usePlan, watchPlan, type Interval } from './planStore'

/** Linhas da comparação: [recurso, Grátis (a edição no aparelho), Pro (na nuvem)]. true/false viram ícone. */
const FEATURES: [string, string | boolean, string | boolean][] = [
  ['Orçamentos e empresas', 'Sem limite', 'Sem limite'],
  ['Onde ficam os dados', 'Só neste aparelho', 'Na nuvem, na sua conta'],
  ['Sincronização entre celular e computador', false, true],
  ['Enviar para a nuvem os dados do grátis', false, true],
  ['Logotipo e cor da sua marca no PDF', false, true],
  ['Funciona sem internet', true, true],
  ['PDF, clientes e catálogo', true, true],
  ['Relatórios e follow-up', true, true],
  ['Backup em arquivo', true, true],
]

const FAQ: [string, string][] = [
  [
    'Como funciona o pagamento?',
    'A assinatura é feita pelo Mercado Pago e renova sozinha a cada mês ou ano, conforme o período escolhido. O Orçafácil não vê nem guarda os dados do seu pagamento.',
  ],
  [
    'Posso cancelar quando quiser?',
    'Sim, em Ajustes › Conta e plano. O Pro continua valendo até o fim do período já pago.',
  ],
  [
    'O que acontece com meus dados se eu cancelar?',
    'Nada é apagado: seus dados continuam na sua conta e você continua vendo tudo, mas novas alterações deixam de ser salvas na nuvem. Exporte um backup em arquivo (Ajustes › Dados) e use o plano grátis, no aparelho, importando esse arquivo.',
  ],
  [
    'Posso levar para a nuvem o que já tenho no grátis?',
    'Sim. No primeiro acesso com a conta, o app oferece enviar os dados do navegador (ou de um backup em arquivo) para a nuvem. Nada é substituído.',
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
  const { loaded, view, prices, busy } = usePlan()
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
        description="Para quem usa em mais de um aparelho: seus dados na nuvem, sincronizados entre celular e computador."
      />

      {loaded && view.pro && (
        <Card className="mb-6 border-brand-200 bg-brand-50">
          <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5" role="status">
            <Crown size={20} className="text-brand-700" aria-hidden />
            <p className="flex-1 text-sm text-slate-800">
              <strong>Você já é {view.title}.</strong> {view.detail}
            </p>
            <Link to="/ajustes" className="text-sm font-medium text-brand-700 underline">
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
              <p className="text-sm text-slate-500">No aparelho, sem cadastro.</p>
            </div>
            <p>
              <span className="text-3xl font-bold tracking-tight text-slate-900">R$ 0</span>
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Orçamentos e empresas sem limite
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> PDF, clientes, catálogo e
                relatórios
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Dados salvos só neste aparelho
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Backup em arquivo, quando quiser
              </li>
            </ul>
          </div>
        </Card>

        <Card className="relative order-1 border-2 border-brand-500 md:order-2">
          <div className="flex h-full flex-col gap-4 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Crown size={18} className="text-brand-600" aria-hidden /> Pro
                <Badge className="bg-brand-50 text-brand-700">Na nuvem</Badge>
              </h2>
              <p className="text-sm text-slate-500">Para quem usa em mais de um aparelho.</p>
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
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Tudo do plano grátis
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong>Sincronização</strong> entre celular e computador
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Seus dados na nuvem, de qualquer
                aparelho, com a sua conta
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong>Logotipo e cor da sua marca</strong> no PDF
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={18} className="shrink-0 text-emerald-600" aria-hidden /> Leva para a nuvem o que você já
                tem no grátis
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
                <th scope="col" className="w-28 px-2 py-3 text-center sm:w-40">
                  Grátis
                </th>
                <th scope="col" className="w-28 px-2 py-3 text-center text-brand-700 sm:w-40">
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
        <Faq items={FAQ} />
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
