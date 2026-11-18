import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, BookmarkPlus, Copy, MoreVertical, Package, Plus, Search, Trash2 } from 'lucide-react'
import type { CatalogItem, QuoteItem } from '../types'
import { useStore } from '../store/store'
import { newItem, nowISO, uid } from '../store/factories'
import { itemTotal } from '../lib/calc'
import { formatCurrency } from '../lib/format'
import { NumberInput } from './NumberInput'
import { UnitSelect } from './UnitSelect'
import { Button, Input, Modal, Textarea, cn, inputClass } from './ui'
import { toast } from './toast'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Campo de descrição com sugestões do catálogo enquanto digita */
function DescriptionInput({
  value,
  onChange,
  onPick,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  onPick: (c: CatalogItem) => void
  inputRef: (el: HTMLInputElement | null) => void
}) {
  const catalog = useStore((s) => s.catalog)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const suggestions = useMemo(() => {
    const q = norm(value.trim())
    if (!q) return catalog.slice(0, 6)
    return catalog.filter((c) => norm(c.description).includes(q) && norm(c.description) !== q).slice(0, 6)
  }, [catalog, value])
  const show = open && suggestions.length > 0

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!show) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onPick(suggestions[hi])
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={cn(inputClass, 'font-medium')}
        placeholder={catalog.length ? 'Descreva ou busque no catálogo…' : 'Descrição do serviço'}
        value={value}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul
          role="listbox"
          className="absolute inset-x-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          <li className="px-3 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            Do catálogo
          </li>
          {suggestions.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault()
                onPick(c)
                setOpen(false)
              }}
              onMouseEnter={() => setHi(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm',
                i === hi && 'bg-brand-50',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">{c.description}</span>
                {c.details && <span className="block truncate text-xs text-slate-500">{c.details}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                {formatCurrency(c.unitPrice)}/{c.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RowMenu({
  onUp,
  onDown,
  onDuplicate,
  onSaveCatalog,
  onDelete,
  canUp,
  canDown,
}: {
  onUp: () => void
  onDown: () => void
  onDuplicate: () => void
  onSaveCatalog: () => void
  onDelete: () => void
  canUp: boolean
  canDown: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const item = (label: string, Icon: typeof Copy, fn: () => void, disabled = false, danger = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        fn()
        setOpen(false)
      }}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40',
        danger ? 'text-red-600' : 'text-slate-700',
      )}
    >
      <Icon size={15} /> {label}
    </button>
  )

  return (
    <div ref={ref} className="relative">
      <Button size="icon" variant="ghost" aria-label="Mais ações do item" onClick={() => setOpen((o) => !o)}>
        <MoreVertical size={16} />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {item('Mover para cima', ArrowUp, onUp, !canUp)}
          {item('Mover para baixo', ArrowDown, onDown, !canDown)}
          {item('Duplicar item', Copy, onDuplicate)}
          {item('Salvar no catálogo', BookmarkPlus, onSaveCatalog)}
          <div className="my-1 border-t border-slate-100" />
          {item('Remover item', Trash2, onDelete, false, true)}
        </div>
      )}
    </div>
  )
}

function CatalogPicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (items: CatalogItem[]) => void
}) {
  const catalog = useStore((s) => s.catalog)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const filtered = catalog
    .filter((c) => !query || norm(`${c.description} ${c.details}`).includes(norm(query)))
    .sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'))

  const close = () => {
    setSelected([])
    setQuery('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Adicionar do catálogo"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!selected.length}
            onClick={() => {
              onAdd(catalog.filter((c) => selected.includes(c.id)))
              close()
            }}
          >
            Adicionar {selected.length ? `(${selected.length})` : ''}
          </Button>
        </>
      }
    >
      {catalog.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Seu catálogo está vazio. Use “Salvar no catálogo” no menu de um item ou cadastre em Serviços.
        </p>
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              autoFocus
              placeholder="Buscar serviço…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filtered.map((c) => {
              const checked = selected.includes(c.id)
              return (
                <li key={c.id}>
                  <label
                    className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5', checked && 'bg-brand-50/60')}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={checked}
                      onChange={() => setSelected((s) => (checked ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.description}</span>
                      {c.details && <span className="block truncate text-xs text-slate-500">{c.details}</span>}
                    </span>
                    <span className="text-sm text-slate-600 tabular-nums">
                      {formatCurrency(c.unitPrice)}
                      <span className="text-slate-400">/{c.unit}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Modal>
  )
}

export function ItemsEditor({ items, onChange }: { items: QuoteItem[]; onChange: (items: QuoteItem[]) => void }) {
  const saveCatalogItem = useStore((s) => s.saveCatalogItem)
  const catalog = useStore((s) => s.catalog)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({})
  const descRefs = useRef(new Map<string, HTMLInputElement>())
  // Linha recém-criada que deve receber foco assim que for renderizada
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    if (pendingFocus.current) {
      descRefs.current.get(pendingFocus.current)?.focus()
      pendingFocus.current = null
    }
  }, [items])

  function focusRow(id: string) {
    const el = descRefs.current.get(id)
    if (el) el.focus()
    else pendingFocus.current = id
  }

  const update = (id: string, patch: Partial<QuoteItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  function addItem(after?: string) {
    const last = items[items.length - 1]
    const it = newItem({ unit: last?.unit ?? 'un' })
    if (after) {
      const idx = items.findIndex((x) => x.id === after)
      const copy = [...items]
      copy.splice(idx + 1, 0, it)
      onChange(copy)
    } else onChange([...items, it])
    pendingFocus.current = it.id
  }

  function move(idx: number, dir: -1 | 1) {
    const copy = [...items]
    const [it] = copy.splice(idx, 1)
    copy.splice(idx + dir, 0, it)
    onChange(copy)
  }

  function remove(id: string) {
    const next = items.filter((x) => x.id !== id)
    onChange(next.length ? next : [newItem()])
  }

  function pickCatalog(id: string, c: CatalogItem) {
    update(id, {
      catalogId: c.id,
      description: c.description,
      details: c.details,
      unit: c.unit,
      unitPrice: c.unitPrice,
    })
    if (c.details) setDetailsOpen((d) => ({ ...d, [id]: true }))
  }

  function addFromCatalog(list: CatalogItem[]) {
    const fresh = list.map((c) =>
      newItem({
        catalogId: c.id,
        description: c.description,
        details: c.details,
        unit: c.unit,
        unitPrice: c.unitPrice,
      }),
    )
    // Substitui a linha vazia inicial, se houver
    const base = items.filter((it) => it.description.trim() || it.unitPrice)
    onChange([...base, ...fresh])
    toast(`${fresh.length} ${fresh.length === 1 ? 'item adicionado' : 'itens adicionados'}`)
  }

  function saveToCatalog(it: QuoteItem) {
    if (!it.description.trim()) return toast('Preencha a descrição antes de salvar', 'error')
    const existing = catalog.find((c) => norm(c.description) === norm(it.description))
    const catalogId = existing?.id ?? uid()
    saveCatalogItem({
      id: catalogId,
      description: it.description.trim(),
      details: it.details,
      unit: it.unit,
      unitPrice: it.unitPrice,
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    })
    update(it.id, { catalogId })
    toast(existing ? 'Item atualizado no catálogo' : 'Item salvo no catálogo')
  }

  /** Enter em quantidade/preço cria nova linha logo abaixo */
  const enterAdds = (id: string) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const idx = items.findIndex((x) => x.id === id)
      if (idx === items.length - 1) addItem()
      else focusRow(items[idx + 1].id)
    }
  }

  return (
    <div className="@container">
      {/* Cabeçalho da tabela (telas largas) */}
      <div className="hidden grid-cols-[24px_minmax(0,1fr)_84px_88px_136px_116px_36px] gap-2 border-b border-slate-100 px-5 pb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase @3xl:grid">
        <span>#</span>
        <span>Descrição</span>
        <span>Unidade</span>
        <span className="text-right">Qtd</span>
        <span className="text-right">Valor unit.</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      <ol className="divide-y divide-slate-100">
        {items.map((it, idx) => {
          const showDetails = detailsOpen[it.id] || !!it.details
          return (
            <li key={it.id} className="px-4 py-3 sm:px-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 @3xl:grid-cols-[24px_minmax(0,1fr)_84px_88px_136px_116px_36px] @3xl:items-start">
                <span className="hidden pt-2.5 text-sm text-slate-400 tabular-nums @3xl:block">{idx + 1}</span>

                <div className="min-w-0">
                  <DescriptionInput
                    value={it.description}
                    inputRef={(el) => {
                      if (el) descRefs.current.set(it.id, el)
                      else descRefs.current.delete(it.id)
                    }}
                    onChange={(description) =>
                      // Apagar a descrição desfaz o vínculo com o catálogo; editar mantém (é uma variação do serviço)
                      update(it.id, description.trim() ? { description } : { description, catalogId: null })
                    }
                    onPick={(c) => pickCatalog(it.id, c)}
                  />
                  {showDetails ? (
                    <Textarea
                      rows={2}
                      autoFocus={!it.details}
                      className="mt-2 min-h-0 text-[13px]"
                      placeholder="Detalhes (opcional): materiais, escopo, observações do item…"
                      value={it.details}
                      onChange={(e) => update(it.id, { details: e.target.value })}
                    />
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="mt-1 text-xs font-medium text-slate-400 hover:text-brand-600"
                      onClick={() => setDetailsOpen((d) => ({ ...d, [it.id]: true }))}
                    >
                      + adicionar detalhes
                    </button>
                  )}
                </div>

                {/* Menu no mobile fica ao lado da descrição */}
                <div className="@3xl:hidden">
                  <RowMenu
                    canUp={idx > 0}
                    canDown={idx < items.length - 1}
                    onUp={() => move(idx, -1)}
                    onDown={() => move(idx, 1)}
                    onDuplicate={() => {
                      const copy = [...items]
                      copy.splice(idx + 1, 0, { ...it, id: uid() })
                      onChange(copy)
                    }}
                    onSaveCatalog={() => saveToCatalog(it)}
                    onDelete={() => remove(it.id)}
                  />
                </div>

                <div className="col-span-2 grid grid-cols-3 gap-2 @3xl:contents">
                  <label className="@3xl:block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500 @3xl:hidden">Unidade</span>
                    <UnitSelect
                      value={it.unit}
                      aria-label="Unidade"
                      onValueChange={(unit) => update(it.id, { unit })}
                    />
                  </label>
                  <label className="@3xl:block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500 @3xl:hidden">Qtd</span>
                    <NumberInput
                      aria-label="Quantidade"
                      value={it.quantity}
                      decimals={3}
                      onValueChange={(quantity) => update(it.id, { quantity })}
                      onKeyDown={enterAdds(it.id)}
                    />
                  </label>
                  <label className="@3xl:block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500 @3xl:hidden">Valor unit.</span>
                    <NumberInput
                      aria-label="Valor unitário"
                      currency
                      value={it.unitPrice}
                      onValueChange={(unitPrice) => update(it.id, { unitPrice })}
                      onKeyDown={enterAdds(it.id)}
                    />
                  </label>
                </div>

                <div className="col-span-2 flex items-center justify-between @3xl:col-span-1 @3xl:block @3xl:pt-2.5 @3xl:text-right">
                  <span className="text-xs text-slate-500 @3xl:hidden">Total do item</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(itemTotal(it))}</span>
                </div>

                <div className="hidden @3xl:block">
                  <RowMenu
                    canUp={idx > 0}
                    canDown={idx < items.length - 1}
                    onUp={() => move(idx, -1)}
                    onDown={() => move(idx, 1)}
                    onDuplicate={() => {
                      const copy = [...items]
                      copy.splice(idx + 1, 0, { ...it, id: uid() })
                      onChange(copy)
                    }}
                    onSaveCatalog={() => saveToCatalog(it)}
                    onDelete={() => remove(it.id)}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
        <Button variant="subtle" onClick={() => addItem()}>
          <Plus size={16} /> Adicionar item
        </Button>
        <Button variant="ghost" onClick={() => setPickerOpen(true)}>
          <Package size={16} /> Do catálogo
        </Button>
        <span className="ml-auto hidden text-xs text-slate-400 lg:inline">
          Dica: <kbd className="rounded border border-slate-200 bg-slate-50 px-1">Enter</kbd> no preço cria o próximo
          item
        </span>
      </div>

      <CatalogPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={addFromCatalog} />
    </div>
  )
}
