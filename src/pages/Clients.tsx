import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileText, Mail, Phone, Plus, Search, Users } from 'lucide-react'
import { useStore } from '../store/store'
import { newClient } from '../store/factories'
import type { Client } from '../types'
import { quoteBelongsToClient } from '../lib/clientQuotes'
import { Button, Card, EmptyState, Input, PageHeader } from '../components/ui'
import { ClientFormModal } from '../components/ClientFormModal'

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Clients() {
  const clients = useStore((s) => s.clients)
  const quotes = useStore((s) => s.quotes)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState<Client | null>(null)

  const filtered = useMemo(() => {
    const q = normalize(query)
    return clients
      .toSorted((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .filter((c) => !q || normalize(`${c.name} ${c.document} ${c.email} ${c.phone} ${c.contactName}`).includes(q))
  }, [clients, query])

  const quoteCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of clients) counts.set(c.id, quotes.filter((q) => quoteBelongsToClient(q, c)).length)
    return counts
  }, [clients, quotes])

  const startNew = () => setCreating(newClient())

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastre uma vez e selecione em qualquer orçamento."
        actions={
          <Button variant="primary" onClick={startNew}>
            <Plus size={16} /> Novo cliente
          </Button>
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Nenhum cliente ainda"
          description="Clientes também podem ser salvos direto do editor de orçamento."
          action={
            <Button variant="primary" onClick={startNew}>
              <Plus size={16} /> Cadastrar cliente
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, documento, e-mail…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {filtered.map((c) => {
              const count = quoteCount.get(c.id) ?? 0
              return (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
                  onClick={() => navigate(`/clientes/${c.id}`)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{c.name}</p>
                    <p className="flex flex-wrap gap-x-4 text-sm text-slate-500">
                      {c.document && (
                        <span>
                          {c.docType} {c.document}
                        </span>
                      )}
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} /> {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} /> {c.email}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500"
                    title={`${count} orçamento${count === 1 ? '' : 's'}`}
                  >
                    <FileText size={14} className="text-slate-400" /> {count}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </button>
              )
            })}
            {filtered.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhum resultado.</p>}
          </Card>
        </>
      )}

      <ClientFormModal key={creating?.id ?? 'none'} client={creating} onClose={() => setCreating(null)} />
    </>
  )
}
