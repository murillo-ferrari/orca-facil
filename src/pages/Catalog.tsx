import { useMemo, useState } from 'react'
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../store/store'
import { nowISO, uid } from '../store/factories'
import type { CatalogItem } from '../types'
import { formatCurrency } from '../lib/format'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea, TextField } from '../components/ui'
import { NumberInput } from '../components/NumberInput'
import { UnitSelect } from '../components/UnitSelect'
import { toast } from '../components/toast'

const newCatalogItem = (): CatalogItem => ({
  id: uid(),
  description: '',
  details: '',
  unit: 'un',
  unitPrice: 0,
  createdAt: nowISO(),
  updatedAt: nowISO(),
})

export function Catalog() {
  const catalog = useStore((s) => s.catalog)
  const save = useStore((s) => s.saveCatalogItem)
  const remove = useStore((s) => s.deleteCatalogItem)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [tried, setTried] = useState(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalog
      .toSorted((a, b) => a.description.localeCompare(b.description, 'pt-BR'))
      .filter((c) => !q || `${c.description} ${c.details}`.toLowerCase().includes(q))
  }, [catalog, query])

  const isNew = editing && !catalog.some((c) => c.id === editing.id)

  function open(c: CatalogItem) {
    setTried(false)
    setEditing({ ...c })
  }

  function handleSave() {
    if (!editing) return
    setTried(true)
    if (!editing.description.trim()) return
    save(editing)
    toast(isNew ? 'Serviço adicionado ao catálogo' : 'Serviço atualizado')
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Catálogo de serviços"
        description="Itens que você orça com frequência, com unidade e preço já definidos."
        actions={
          <Button variant="primary" onClick={() => open(newCatalogItem())}>
            <Plus size={16} /> Novo serviço
          </Button>
        }
      />

      {catalog.length === 0 ? (
        <EmptyState
          icon={<Package size={22} />}
          title="Catálogo vazio"
          description="Adicione serviços aqui ou salve itens direto do editor de orçamento para reutilizá-los com um clique."
          action={
            <Button variant="primary" onClick={() => open(newCatalogItem())}>
              <Plus size={16} /> Adicionar serviço
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar serviço…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Card className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <button className="min-w-0 flex-1 text-left" onClick={() => open(c)}>
                  <p className="truncate font-medium text-slate-900">{c.description}</p>
                  {c.details && <p className="truncate text-sm text-slate-500">{c.details}</p>}
                </button>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 tabular-nums">{formatCurrency(c.unitPrice)}</p>
                  <p className="text-xs text-slate-500">por {c.unit}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(c)}>
                  <Pencil size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir"
                  className="hover:text-red-600"
                  onClick={() => {
                    if (window.confirm(`Remover “${c.description}” do catálogo?`)) {
                      remove(c.id)
                      toast('Serviço removido')
                    }
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            {filtered.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhum resultado.</p>}
          </Card>
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Novo serviço' : 'Editar serviço'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Salvar
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Descrição"
              autoFocus
              className="col-span-2"
              value={editing.description}
              error={tried && !editing.description.trim() ? 'Informe a descrição' : undefined}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
            <Field label="Detalhes" hint="Opcional — aparece abaixo da descrição no PDF" className="col-span-2">
              <Textarea
                rows={2}
                value={editing.details}
                onChange={(e) => setEditing({ ...editing, details: e.target.value })}
              />
            </Field>
            <Field label="Unidade">
              <UnitSelect value={editing.unit} onValueChange={(unit) => setEditing({ ...editing, unit })} />
            </Field>
            <Field label="Preço unitário">
              <NumberInput
                currency
                value={editing.unitPrice}
                onValueChange={(unitPrice) => setEditing({ ...editing, unitPrice })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
