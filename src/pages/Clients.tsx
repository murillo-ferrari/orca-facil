import { useMemo, useState } from 'react'
import { Mail, Pencil, Phone, Plus, Search, Trash2, Users } from 'lucide-react'
import { useStore } from '../store/store'
import { newClient } from '../store/factories'
import type { Client } from '../types'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea } from '../components/ui'
import { ClientFields } from '../components/ClientFields'
import { toast } from '../components/toast'

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Clients() {
  const clients = useStore((s) => s.clients)
  const saveClient = useStore((s) => s.saveClient)
  const deleteClient = useStore((s) => s.deleteClient)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Client | null>(null)
  const [tried, setTried] = useState(false)

  const filtered = useMemo(() => {
    const q = normalize(query)
    return [...clients]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .filter((c) => !q || normalize(`${c.name} ${c.document} ${c.email} ${c.phone} ${c.contactName}`).includes(q))
  }, [clients, query])

  const isNew = editing && !clients.some((c) => c.id === editing.id)

  function open(c: Client) {
    setTried(false)
    setEditing(structuredClone(c))
  }

  function handleSave() {
    if (!editing) return
    setTried(true)
    if (!editing.name.trim()) return
    saveClient(editing)
    toast(isNew ? 'Cliente cadastrado' : 'Cliente atualizado')
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastre uma vez e selecione em qualquer orçamento."
        actions={
          <Button variant="primary" onClick={() => open(newClient())}>
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
            <Button variant="primary" onClick={() => open(newClient())}>
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
          <Card className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <button className="min-w-0 flex-1 text-left" onClick={() => open(c)}>
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
                </button>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(c)}>
                  <Pencil size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir"
                  className="hover:text-red-600"
                  onClick={() => {
                    if (window.confirm(`Excluir o cliente “${c.name}”?`)) {
                      deleteClient(c.id)
                      toast('Cliente excluído')
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
        title={isNew ? 'Novo cliente' : 'Editar cliente'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Salvar cliente
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <ClientFields
              autoFocus
              value={editing}
              onChange={setEditing}
              nameError={tried && !editing.name.trim() ? 'Informe o nome do cliente' : undefined}
            />
            <Field label="Anotações internas" hint="Não aparecem no orçamento">
              <Textarea
                rows={2}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
