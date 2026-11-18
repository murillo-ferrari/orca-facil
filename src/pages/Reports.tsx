import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { BarChart3, Printer } from 'lucide-react'
import { useActiveProfile, useStore } from '../store/store'
import { todayISO } from '../lib/format'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { cn } from '../components/styles'
import { defaultFilters, filterOptions, type ReportContext, type ReportFilters } from '../reports/data'
import { FilterBar } from '../reports/FilterBar'
import { describeFilters, type FilterAvailability } from '../reports/describeFilters'
import { OverviewView } from '../reports/OverviewView'
import { FollowUpView } from '../reports/FollowUpView'
import { ClientsView, DiscountsView, ServicesView } from '../reports/TableViews'
import type { ViewProps } from '../reports/shared'

const TABS: {
  slug: string
  label: string
  Component: (p: ViewProps) => ReactNode
  availability?: FilterAvailability
}[] = [
  { slug: '', label: 'Visão geral', Component: OverviewView },
  {
    slug: 'follow-up',
    label: 'Follow-up',
    Component: FollowUpView,
    availability: { period: 'não se aplica', status: 'sempre “Enviado”' },
  },
  { slug: 'clientes', label: 'Clientes', Component: ClientsView },
  { slug: 'servicos', label: 'Serviços', Component: ServicesView },
  { slug: 'descontos', label: 'Descontos', Component: DiscountsView },
]

const FILTERS_KEY = 'gerador-orcamento:filtros-relatorios'

function loadFilters(fallbackProfile: string): ReportFilters {
  try {
    const saved = JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? 'null')
    if (saved) return { ...defaultFilters(fallbackProfile), ...saved }
  } catch {
    /* sem storage disponível */
  }
  return defaultFilters(fallbackProfile)
}

export function Reports() {
  const { tab = '' } = useParams()
  const navigate = useNavigate()
  const profiles = useStore((s) => s.profiles)
  const quotes = useStore((s) => s.quotes)
  const clients = useStore((s) => s.clients)
  const catalog = useStore((s) => s.catalog)
  const active = useActiveProfile()
  const [filters, setFiltersState] = useState<ReportFilters>(() => loadFilters(active?.id ?? ''))
  // Horário do cabeçalho de impressão: atualizado no momento em que a pessoa manda imprimir
  const [generatedAt, setGeneratedAt] = useState(() => new Date())
  useEffect(() => {
    const onBeforePrint = () => setGeneratedAt(new Date())
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [])

  const setFilters = (f: ReportFilters) => {
    setFiltersState(f)
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify(f))
    } catch {
      /* ignora */
    }
  }

  // Empresa salva nos filtros pode ter sido excluída
  const effective: ReportFilters =
    filters.profileId && !profiles.some((p) => p.id === filters.profileId)
      ? { ...filters, profileId: active?.id ?? '' }
      : filters

  const ctx: ReportContext = useMemo(
    () => ({ quotes, clients, catalog, today: todayISO() }),
    [quotes, clients, catalog],
  )
  const options = useMemo(() => filterOptions(ctx, effective.profileId), [ctx, effective.profileId])

  const current = TABS.find((t) => t.slug === tab) ?? TABS[0]

  if (!profiles.length) {
    return (
      <EmptyState
        icon={<BarChart3 size={22} />}
        title="Sem dados para relatórios"
        description="Cadastre sua empresa e crie orçamentos para ver os relatórios."
        action={<Button onClick={() => navigate('/empresas/nova')}>Cadastrar empresa</Button>}
      />
    )
  }

  const View = current.Component
  const summary = describeFilters(effective, profiles, options, current.availability)

  return (
    <>
      {/* Cabeçalho que só aparece na impressão */}
      <div className="mb-4 hidden border-b border-slate-300 pb-3 print:block">
        <p className="text-xs tracking-wide text-slate-500 uppercase">Relatório</p>
        <h1 className="text-xl font-semibold text-slate-900">{current.label}</h1>
        <p className="mt-1 text-xs text-slate-600">{summary.join(' · ')}</p>
        <p className="text-xs text-slate-400">Gerado em {generatedAt.toLocaleString('pt-BR')}</p>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          description="Acompanhe seus orçamentos, clientes e serviços."
          actions={
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Imprimir / PDF
            </Button>
          }
        />

        <nav
          className="-mx-4 mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-slate-200 px-4 sm:mx-0 sm:px-0"
          aria-label="Relatórios"
        >
          {TABS.map((t) => (
            <NavLink
              key={t.slug}
              to={t.slug ? `/relatorios/${t.slug}` : '/relatorios'}
              end
              className={({ isActive }) =>
                cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition',
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <FilterBar
          filters={effective}
          onChange={setFilters}
          profiles={profiles}
          options={options}
          availability={current.availability}
          onReset={() => setFilters(defaultFilters(active?.id ?? ''))}
        />
      </div>

      <View ctx={ctx} filters={effective} profiles={profiles} />
    </>
  )
}
