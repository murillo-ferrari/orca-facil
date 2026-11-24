import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Mail, MapPin, NotebookPen, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { useActiveProfile, useStore } from '../store/store'
import { clientToQuoteClient } from '../store/factories'
import type { QuoteStatus } from '../types'
import { quoteTotals } from '../lib/calc'
import { quoteBelongsToClient } from '../lib/clientQuotes'
import { formatAddressLines, formatCurrency } from '../lib/format'
import { STATUS, STATUS_ORDER } from '../lib/status'
import { Button, Card, CardHeader, EmptyState } from '../components/ui'
import { cn } from '../components/styles'
import { ClientFormModal } from '../components/ClientFormModal'
import { QuoteRow } from '../components/QuoteRow'
import { toast } from '../components/toast'
import { confirmDialog } from '../components/confirm'

export function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const allQuotes = useStore((s) => s.quotes)
  const multipleProfiles = useStore((s) => s.profiles.length > 1)
  const deleteClient = useStore((s) => s.deleteClient)
  const createQuote = useStore((s) => s.createQuote)
  const active = useActiveProfile()
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<QuoteStatus | 'todos'>('todos')

  const quotes = useMemo(
    () =>
      client
        ? allQuotes
            .filter((q) => quoteBelongsToClient(q, client))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [allQuotes, client],
  )

  const stats = useMemo(() => {
    const by = (st: QuoteStatus) => quotes.filter((q) => q.status === st)
    const sum = (list: typeof quotes) => list.reduce((acc, q) => acc + quoteTotals(q).total, 0)
    const approved = by('aprovado')
    // Taxa de aprovação = aprovados ÷ tudo que foi enviado ao cliente (qualquer status exceto rascunho).
    // Enviados ainda sem resposta contam na base: um orçamento só "converte" quando é aprovado.
    const sentCount = quotes.filter((q) => q.status !== 'rascunho').length
    return {
      approvedTotal: sum(approved),
      approvedCount: approved.length,
      pendingTotal: sum(by('enviado')),
      pendingCount: by('enviado').length,
      sentCount,
      approvalRate: sentCount ? Math.round((approved.length / sentCount) * 100) : null,
    }
  }, [quotes])

  if (!client) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        description="Ele pode ter sido excluído."
        action={<Button onClick={() => navigate('/clientes')}>Voltar para clientes</Button>}
      />
    )
  }

  const c = client
  const visible = status === 'todos' ? quotes : quotes.filter((q) => q.status === status)
  const address = formatAddressLines(c.address)

  function handleNewQuote() {
    if (!active) {
      toast('Cadastre sua empresa antes de criar orçamentos', 'error')
      navigate('/empresas/nova')
      return
    }
    const quoteId = createQuote(active.id, clientToQuoteClient(c))
    if (quoteId) navigate(`/orcamentos/${quoteId}`)
  }

  async function handleDelete() {
    const message = quotes.length
      ? `Excluir o cliente “${c.name}”? Os ${quotes.length} orçamento(s) dele continuam salvos.`
      : `Excluir o cliente “${c.name}”?`
    if (!(await confirmDialog({ title: 'Excluir cliente', message, confirmLabel: 'Excluir', danger: true }))) return
    deleteClient(c.id)
    toast('Cliente excluído')
    navigate('/clientes')
  }

  const contactItems = [
    c.contactName && { icon: UserRound, text: `A/C ${c.contactName}` },
    c.phone && { icon: Phone, text: c.phone },
    c.email && { icon: Mail, text: c.email },
    address.length > 0 && { icon: MapPin, text: address.join(' — ') },
  ].filter(Boolean) as { icon: typeof Phone; text: string }[]

  return (
    <>
      <button
        onClick={() => navigate('/clientes')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Clientes
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600">
            {c.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{c.name}</h1>
            {c.document && (
              <p className="text-sm text-slate-500">
                {c.docType} {c.document}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir cliente"
            title="Excluir cliente"
            className="hover:text-red-600"
            onClick={handleDelete}
          >
            <Trash2 size={16} />
          </Button>
          <Button onClick={() => setEditing(true)}>
            <Pencil size={16} /> Editar
          </Button>
          <Button variant="primary" onClick={handleNewQuote}>
            <Plus size={16} /> Novo orçamento
          </Button>
        </div>
      </div>

      {(contactItems.length > 0 || c.notes) && (
        <Card className="mb-5 grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          {contactItems.length > 0 && (
            <ul className="space-y-1.5 text-sm text-slate-700">
              {contactItems.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-2">
                  <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" /> {text}
                </li>
              ))}
            </ul>
          )}
          {c.notes && (
            <div className="flex gap-2 rounded-lg bg-amber-50/60 p-3 text-sm text-slate-700">
              <NotebookPen size={15} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="whitespace-pre-line">{c.notes}</p>
            </div>
          )}
        </Card>
      )}

      {quotes.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Orçamentos</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{quotes.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Aprovados ({stats.approvedCount})</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600 tabular-nums">
              {formatCurrency(stats.approvedTotal)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Aguardando ({stats.pendingCount})</p>
            <p className="mt-1 text-xl font-semibold text-amber-600 tabular-nums">
              {formatCurrency(stats.pendingTotal)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Taxa de aprovação</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {stats.approvalRate === null ? '—' : `${stats.approvalRate}%`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {stats.sentCount
                ? `${stats.approvedCount} de ${stats.sentCount} enviado${stats.sentCount === 1 ? '' : 's'}`
                : 'Nenhum orçamento enviado'}
            </p>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          icon={<FileText size={18} />}
          title="Orçamentos deste cliente"
          actions={
            quotes.length > 0 && (
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                {(['todos', ...STATUS_ORDER] as const).map((st) => {
                  const count = st === 'todos' ? quotes.length : quotes.filter((q) => q.status === st).length
                  if (st !== 'todos' && count === 0) return null
                  return (
                    <button
                      key={st}
                      onClick={() => setStatus(st)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap transition',
                        status === st
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                      )}
                    >
                      {st === 'todos' ? 'Todos' : STATUS[st].label} ({count})
                    </button>
                  )
                })}
              </div>
            )
          }
        />
        {quotes.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">Nenhum orçamento criado para este cliente ainda.</p>
            <Button variant="subtle" className="mt-4" onClick={handleNewQuote}>
              <Plus size={16} /> Criar o primeiro
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((q) => (
              <QuoteRow key={q.id} quote={q} showClient={false} showProfile={multipleProfiles} />
            ))}
          </div>
        )}
      </Card>

      <ClientFormModal
        key={editing ? 'open' : 'closed'}
        client={editing ? c : null}
        onClose={() => setEditing(false)}
      />
    </>
  )
}
