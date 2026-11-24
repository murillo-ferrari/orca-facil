import { lazy, Suspense, useRef, useState } from 'react'
import { DatabaseBackup, Download, Plus, Ruler, RotateCcw, Trash2, Upload } from 'lucide-react'
import { exportSnapshot, useStore } from '../store/store'
import { BackupError, backupFileName, createBackup, parseBackup } from '../data/backup'
import { uid } from '../store/factories'
import { Button, Card, CardHeader, Input } from '../components/ui'
import { toast } from '../components/toast'

// Só na edição Cloud; no build Local este import some
const AccountCard =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/auth/AccountCard')) : null
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
            onClick={() => window.confirm('Restaurar a lista padrão de unidades?') && resetUnits()}
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
    if (!window.confirm('Importar este backup vai SUBSTITUIR todos os dados atuais. Continuar?')) return
    importData(data)
    toast('Backup restaurado')
  }

  return (
    <Card>
      <CardHeader
        icon={<DatabaseBackup size={18} />}
        title="Backup dos dados"
        description="Seus dados ficam salvos apenas neste navegador. Exporte um backup para guardar ou levar para outro computador."
      />
      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        <Button variant="primary" onClick={handleExport}>
          <Download size={16} /> Exportar backup
        </Button>
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
      </div>
    </Card>
  )
}

export function SettingsPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">Ajustes</h1>
      <div className="space-y-5">
        {AccountCard && (
          <Suspense>
            <AccountCard />
          </Suspense>
        )}
        {LimitCard && (
          <Suspense>
            <LimitCard />
          </Suspense>
        )}
        {ConflictsCard && (
          <Suspense>
            <ConflictsCard />
          </Suspense>
        )}
        <UnitsCard />
        <BackupCard />
      </div>
    </>
  )
}
