import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DatabaseBackup, Download, Plus, Ruler, RotateCcw, Trash2, Upload } from 'lucide-react'
import { exportSnapshot, useStore } from '../store/store'
import { BackupError, backupFileName, createBackup, parseBackup } from '../data/backup'
import { uid } from '../store/factories'
import { Button, Card, CardHeader, CardSkeleton, Input } from '../components/ui'
import { toast } from '../components/toast'
import { confirmDialog } from '../components/confirm'
import { cn } from '../components/styles'

// Só na edição Cloud; no build Local este import some
const AccountCard =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/auth/AccountCard')) : null
const ImportCard =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/sync/ImportCard')) : null
const PlanCard =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/billing/PlanCard')) : null
const LimitCard =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/sync/LimitCard')) : null
const ConflictsCard =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/sync/ConflictsCard')) : null

function UnitsCard() {
  const units = useStore((s) => s.units)
  const saveUnit = useStore((s) => s.saveUnit)
  const deleteUnit = useStore((s) => s.deleteUnit)
  const resetUnits = useStore((s) => s.resetUnits)
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')

  function add() {
    const sym = symbol.trim()
    if (!sym) return
    if (units.some((u) => u.symbol.toLowerCase() === sym.toLowerCase())) {
      toast('Essa unidade já existe', 'error')
      return
    }
    saveUnit({ id: uid(), symbol: sym, name: name.trim() || sym })
    setSymbol('')
    setName('')
  }

  return (
    <Card>
      <CardHeader
        icon={<Ruler size={18} />}
        title="Unidades de medida"
        description="Aparecem na seleção de unidade de cada item."
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Restaurar unidades',
                message: 'Restaurar a lista padrão de unidades?',
                confirmLabel: 'Restaurar',
              })
              if (ok) resetUnits()
            }}
          >
            <RotateCcw size={14} /> Restaurar padrão
          </Button>
        }
      />
      <div className="p-4 sm:p-5">
        <form
          className="mb-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Input
            className="w-28"
            placeholder="Sigla"
            aria-label="Sigla da unidade"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
          <Input
            className="min-w-40 flex-1"
            placeholder="Nome (ex.: Ponto elétrico)"
            aria-label="Nome da unidade"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="subtle">
            <Plus size={16} /> Adicionar
          </Button>
        </form>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-200 py-1 pr-1 pl-2">
              <input
                className="w-14 rounded px-1 py-1 font-mono text-sm font-semibold text-slate-900 focus:bg-slate-50 focus:outline-none"
                value={u.symbol}
                aria-label="Sigla"
                onChange={(e) => saveUnit({ ...u, symbol: e.target.value })}
              />
              <input
                className="min-w-0 flex-1 rounded px-1 py-1 text-sm text-slate-600 focus:bg-slate-50 focus:outline-none"
                value={u.name}
                aria-label="Nome"
                onChange={(e) => saveUnit({ ...u, name: e.target.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:text-red-600"
                aria-label={`Remover ${u.symbol}`}
                onClick={() => deleteUnit(u.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function BackupCard() {
  const importData = useStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const blob = new Blob([JSON.stringify(createBackup(exportSnapshot()), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast('Backup exportado')
  }

  async function handleImport(file: File) {
    let data
    try {
      data = parseBackup(await file.text())
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'Arquivo de backup inválido', 'error')
      return
    }
    const ok = await confirmDialog({
      title: 'Importar backup',
      message: 'Importar este backup vai SUBSTITUIR todos os dados atuais. Continuar?',
      confirmLabel: 'Substituir tudo',
      danger: true,
    })
    if (!ok) return
    importData(data)
    toast('Backup restaurado')
  }

  return (
    <Card>
      <CardHeader
        icon={<DatabaseBackup size={18} />}
        title="Backup dos dados"
        description={
          ImportCard
            ? 'Exporte uma cópia dos seus dados em um arquivo, para guardar ou levar para outro computador.'
            : 'Seus dados ficam salvos apenas neste navegador. Exporte um backup para guardar ou levar para outro computador.'
        }
      />
      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        <Button variant="primary" onClick={handleExport}>
          <Download size={16} /> Exportar backup
        </Button>
        {/* Na Cloud, "substituir tudo" excluiria dados na nuvem; a importação por arquivo fica em "Enviar dados para a nuvem" */}
        {!ImportCard && (
          <>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImport(f)
                e.target.value = ''
              }}
            />
          </>
        )}
      </div>
    </Card>
  )
}

/** Cartão carregado sob demanda; `skeleton` reserva o espaço enquanto o código chega (sem, não ocupa nada). */
const lazyCard = (Card: ReturnType<typeof lazy> | null, skeleton?: ReactNode) =>
  Card && (
    <Suspense fallback={skeleton}>
      <Card />
    </Suspense>
  )

// Alturas medidas dos cartões reais (celular 390px / computador), para o skeleton não pular ao trocar
const PLAN_SKELETON = 'h-[218px] sm:h-[186px]'

/** Abas de Ajustes (rotas, como em Relatórios). "Conta e plano" só existe na edição Cloud. */
const TABS = [
  ...(AccountCard ? [{ slug: '', label: 'Conta e plano' }] : []),
  { slug: 'dados', label: 'Dados' },
  { slug: 'outros', label: 'Outros' },
]

export function SettingsPage() {
  const { tab = '' } = useParams()
  // Endereço sem aba (ou aba inexistente) abre a primeira
  const current = TABS.find((t) => t.slug === tab) ?? TABS[0]

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">Ajustes</h1>

      <nav
        className="-mx-4 mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Ajustes"
      >
        {TABS.map((t) => (
          <Link
            key={t.slug}
            to={t.slug ? `/config/${t.slug}` : '/config'}
            aria-current={t === current ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition',
              t === current
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-5">
        {current.slug === '' && (
          <>
            {lazyCard(AccountCard, <CardSkeleton className="h-[262px] sm:h-[154px]" />)}
            {lazyCard(PlanCard, <CardSkeleton className={PLAN_SKELETON} />)}
            {/* Sem skeleton: quase sempre não mostra nada, e reservar espaço criaria o salto */}
            {lazyCard(LimitCard)}
          </>
        )}
        {current.slug === 'dados' && (
          <>
            {lazyCard(ConflictsCard, <CardSkeleton lines={2} className="h-[186px] sm:h-[154px]" />)}
            {lazyCard(ImportCard, <CardSkeleton lines={2} className="h-[262px] sm:h-[210px]" />)}
            <BackupCard />
          </>
        )}
        {current.slug === 'outros' && <UnitsCard />}
      </div>
    </>
  )
}
