import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Cloud } from 'lucide-react'
import { Badge, Card } from '../../../components/ui'
import { Faq } from '../../../components/Faq'
import { formatCurrency } from '../../../lib/format'
import { supabase } from '../supabase'
import { rememberAfterLogin } from '../auth/afterLogin'
import { Showcase } from './Showcase'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { GITHUB_URL } from './site'

// A edição Local (o plano grátis) é servida no mesmo domínio, em /gratis/ (npm run build:site). Por ser a mesma origem,
// o localStorage dela é visível para a Cloud: quem assina o Pro já tem os dados do grátis à mão para enviar.
const LOCAL_URL = '/gratis/'

const btn =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
const btnPrimary = `${btn} h-12 bg-brand-600 px-5 text-base text-white shadow-sm hover:bg-brand-700`
const btnSecondary = `${btn} h-12 border border-slate-300 bg-white px-5 text-base text-slate-700 shadow-sm hover:bg-slate-50`

const STEPS: [string, string][] = [
  ['Cadastre sua empresa', 'Informe seus dados, a validade e a forma de pagamento que você costuma usar.'],
  ['Monte o orçamento', 'Adicione os itens (ou escolha do catálogo), aplique desconto e veja o total na hora.'],
  ['Envie e acompanhe', 'Gere o PDF, marque como enviado, aprovado ou recusado e acompanhe tudo nos relatórios.'],
]

const FAQ: [string, ReactNode][] = [
  [
    'Preciso pagar para usar?',
    'Não. O plano grátis não pede cadastro: você abre, usa e seus orçamentos ficam salvos no próprio aparelho, sem limite de orçamentos nem de empresas.',
  ],
  [
    'Onde ficam os meus dados?',
    'No plano grátis, só no navegador do aparelho que você usa; nada é enviado para a internet. No Pro, ficam na sua conta, na nuvem, e cada conta só enxerga os próprios dados. Você pode excluir a conta e tudo é apagado.',
  ],
  [
    'E se eu trocar de celular ou de navegador?',
    'No grátis, exporte um backup em arquivo e importe no outro aparelho. No Pro, é só entrar com a sua conta: tudo já está lá.',
  ],
  [
    'Já uso o grátis. Posso passar para o Pro?',
    'Sim. Assine o Pro e, no primeiro acesso, o app oferece enviar para a nuvem os dados que estão no navegador, ou de um arquivo de backup. Nada é substituído.',
  ],
  [
    'Posso cancelar o Pro quando quiser?',
    'Sim. O Pro continua valendo até o fim do período já pago. Seus dados não são apagados: você pode exportar um backup em arquivo e continuar no grátis, no aparelho.',
  ],
  [
    'O código é aberto?',
    <>
      Sim, sob a licença AGPL-3.0. Você pode ver e baixar o código no{' '}
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">
        GitHub
      </a>
      .
    </>,
  ],
]

function Item({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

/** Desenho decorativo de um orçamento (só para a vitrine; não é dado real). */
function QuoteMock() {
  const rows: [string, string][] = [
    ['Instalação de ponto elétrico', 'R$ 280,00'],
    ['Troca de disjuntor (2×)', 'R$ 190,00'],
    ['Mão de obra', 'R$ 450,00'],
  ]
  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-sm rotate-1 rounded-xl border border-slate-200 bg-white p-5 shadow-xl select-none"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-slate-500">ORC-0042</span>
        <Badge className="bg-emerald-50 text-emerald-700">Aprovado</Badge>
      </div>
      <p className="mt-3 text-lg font-semibold text-slate-900">Reforma elétrica</p>
      <p className="text-sm text-slate-500">Cliente: Marina Souza · Válido por 15 dias</p>
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {rows.map(([name, value]) => (
          <li key={name} className="flex justify-between gap-3 py-2">
            <span className="text-slate-700">{name}</span>
            <span className="tabular-nums text-slate-900">{value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-3">
        <span className="text-sm text-slate-500">Total</span>
        <span className="text-2xl font-bold text-slate-900 tabular-nums">R$ 920,00</span>
      </div>
    </div>
  )
}

/** Página inicial da edição Cloud (/, sem sessão): o que é, o que faz, planos e a entrada para a conta. */
export default function Landing() {
  const [prices, setPrices] = useState<{ mensal?: number; anual?: number }>({})

  useEffect(() => {
    // Preço vem do banco (tabela plan_prices, leitura pública); falhou ou demorou, a página segue sem o valor
    void supabase
      .from('plan_prices')
      .select('billing_interval, amount')
      .then(({ data }) => {
        if (data) setPrices(Object.fromEntries(data.map((p) => [p.billing_interval, Number(p.amount)])))
      })
  }, [])

  const { mensal, anual } = prices
  const saving = mensal && anual ? Math.round((1 - anual / (mensal * 12)) * 100) : 0

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <SiteHeader>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm font-medium">
          <a href="#recursos" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">
            Recursos
          </a>
          <a href="#planos" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">
            Planos
          </a>
          <Link
            to="/entrar"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Entrar
          </Link>
        </nav>
      </SiteHeader>

      <main>
        <section className="bg-gradient-to-b from-brand-50 to-white" aria-labelledby="titulo">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-20">
            <div>
              <h1 id="titulo" className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Orçamentos de serviço prontos em minutos
              </h1>
              <p className="mt-4 max-w-xl text-lg text-slate-600">
                Para autônomos e pequenas empresas: crie orçamentos profissionais direto do celular, exporte em PDF e
                acompanhe o que foi aprovado.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={LOCAL_URL} className={btnPrimary}>
                  Usar grátis <ArrowRight size={18} aria-hidden />
                </a>
                <Link to="/entrar" className={btnSecondary}>
                  Entrar na minha conta
                </Link>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                O plano grátis não pede cadastro: seus dados ficam no seu aparelho.
              </p>
            </div>
            <QuoteMock />
          </div>
        </section>

        <section
          id="recursos"
          className="scroll-mt-16 mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          aria-labelledby="recursos-t"
        >
          <h2 id="recursos-t" className="text-2xl font-semibold tracking-tight text-slate-900">
            Tudo o que você precisa para orçar e fechar
          </h2>
          <Showcase />
        </section>

        <section className="bg-slate-50" aria-labelledby="como-t">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 id="como-t" className="text-2xl font-semibold tracking-tight text-slate-900">
              Como funciona
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="planos"
          className="scroll-mt-16 mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          aria-labelledby="planos-t"
        >
          <h2 id="planos-t" className="text-2xl font-semibold tracking-tight text-slate-900">
            Comece grátis. Leve para a nuvem quando quiser.
          </h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="order-2 md:order-1">
              <div className="flex h-full flex-col gap-4 p-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Grátis</h3>
                  <p className="text-sm text-slate-500">No seu aparelho, sem cadastro.</p>
                </div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">R$ 0</p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <Item>Orçamentos e empresas sem limite</Item>
                  <Item>PDF, clientes, catálogo e relatórios</Item>
                  <Item>Dados salvos só no navegador deste aparelho</Item>
                  <Item>Backup em arquivo, quando você quiser</Item>
                </ul>
                <a href={LOCAL_URL} className={`${btnSecondary} mt-auto w-full`}>
                  Usar grátis
                </a>
              </div>
            </Card>

            <Card className="order-1 border-2 border-brand-500 md:order-2">
              <div className="flex h-full flex-col gap-4 p-6">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Cloud size={18} className="text-brand-600" aria-hidden /> Pro
                    <Badge className="bg-brand-50 text-brand-700">Na nuvem</Badge>
                  </h3>
                  <p className="text-sm text-slate-500">Para quem usa em mais de um aparelho.</p>
                </div>
                <p className="min-h-[3.25rem]">
                  {mensal && (
                    <>
                      <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                        {formatCurrency(mensal)}
                      </span>
                      <span className="text-sm text-slate-500">/mês</span>
                      {anual && (
                        <span className="block text-xs text-slate-500">
                          ou {formatCurrency(anual)}/ano{saving > 0 ? ` (economize ${saving}%)` : ''}
                        </span>
                      )}
                    </>
                  )}
                </p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <Item>Tudo do plano grátis</Item>
                  <Item>
                    <strong>Sincronização</strong> entre celular e computador
                  </Item>
                  <Item>Seus dados na nuvem, de qualquer aparelho, com a sua conta</Item>
                  <Item>Logotipo e cor da sua marca no PDF</Item>
                  <Item>Traz para a nuvem o que você já tem no grátis</Item>
                  <Item>Cancele quando quiser</Item>
                </ul>
                <Link
                  to="/entrar"
                  onClick={() => rememberAfterLogin('/assinatura')}
                  className={`${btnPrimary} mt-auto w-full`}
                >
                  Quero o Pro
                </Link>
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8" aria-labelledby="duvidas-t">
          <h2 id="duvidas-t" className="mb-4 text-2xl font-semibold tracking-tight text-slate-900">
            Perguntas frequentes
          </h2>
          <Faq items={FAQ} />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
