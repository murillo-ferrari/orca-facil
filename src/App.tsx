import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { Building2, FileText, Package, Settings, Users, ChevronsUpDown, Plus } from 'lucide-react'
import { useStore, useActiveProfile } from './store/store'
import { Toaster } from './components/toast'
import { cn } from './components/ui'
import { QuotesList } from './pages/QuotesList'
import { QuoteEditor } from './pages/QuoteEditor'
import { Profiles } from './pages/Profiles'
import { ProfileEditor } from './pages/ProfileEditor'
import { Clients } from './pages/Clients'
import { ClientDetail } from './pages/ClientDetail'
import { Catalog } from './pages/Catalog'
import { SettingsPage } from './pages/Settings'

const NAV = [
  { to: '/', label: 'Orçamentos', icon: FileText, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/servicos', label: 'Serviços', icon: Package },
  { to: '/empresas', label: 'Empresas', icon: Building2 },
  { to: '/config', label: 'Ajustes', icon: Settings },
]

function ProfileSwitcher() {
  const profiles = useStore((s) => s.profiles)
  const setActive = useStore((s) => s.setActiveProfile)
  const active = useActiveProfile()
  const navigate = useNavigate()

  if (!profiles.length) {
    return (
      <button
        onClick={() => navigate('/empresas/nova')}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        <Plus size={16} /> Cadastrar empresa
      </button>
    )
  }

  return (
    <label className="relative flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs hover:border-slate-300">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
        {(active?.label || active?.tradeName || '?').slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] leading-tight text-slate-500">Empresa ativa</span>
        <span className="block truncate text-sm font-medium text-slate-900">
          {active?.label || active?.tradeName || active?.legalName}
        </span>
      </span>
      <ChevronsUpDown size={14} className="text-slate-400" />
      <select
        aria-label="Trocar empresa ativa"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={active?.id}
        onChange={(e) => setActive(e.target.value)}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label || p.tradeName || p.legalName}
          </option>
        ))}
      </select>
    </label>
  )
}

function Shell() {
  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FileText size={16} />
          </div>
          <span className="font-semibold tracking-tight text-slate-900">Orçafácil</span>
        </div>
        <div className="px-3">
          <ProfileSwitcher />
        </div>
        <nav className="mt-5 flex flex-col gap-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-5 py-4 text-xs text-slate-400">Seus dados ficam salvos neste navegador.</p>
      </aside>

      {/* Topo mobile */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <FileText size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <ProfileSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        <Routes>
          <Route path="/" element={<QuotesList />} />
          <Route path="/orcamentos/:id" element={<QuoteEditor />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/clientes/:id" element={<ClientDetail />} />
          <Route path="/servicos" element={<Catalog />} />
          <Route path="/empresas" element={<Profiles />} />
          <Route path="/empresas/:id" element={<ProfileEditor />} />
          <Route path="/config" element={<SettingsPage />} />
          <Route path="*" element={<QuotesList />} />
        </Routes>
      </main>

      {/* Navegação inferior mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-brand-600' : 'text-slate-500',
              )
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
