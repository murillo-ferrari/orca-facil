import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, differenceInCalendarDays } from 'date-fns'
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  ListChecks,
  Loader2,
  Plus,
  Receipt,
  Search,
  Trash2,
  UserRound,
  UserPlus,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { clientToQuoteClient, emptyQuoteClient, newClient, uid } from '../store/factories'
import type { Quote, QuoteClient, QuoteStatus } from '../types'
import { quoteTotals } from '../lib/calc'
import { formatCurrency, formatDateLong, parseDate, toISODate } from '../lib/format'
import { STATUS, STATUS_ORDER } from '../lib/status'
import { DateField } from '../components/DateField'
import { ItemsEditor } from '../components/ItemsEditor'
import { ClientFields } from '../components/ClientFields'
import { NumberInput } from '../components/NumberInput'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
  TextField,
} from '../components/ui'
import { cn } from '../components/styles'
import { toast } from '../components/toast'
import { downloadQuotePdf, renderQuotePdf } from '../pdf/exportPdf'

const VALIDITY_PRESETS = [7, 15, 30, 60]
const PAYMENT_CHIPS = [
  'À vista via PIX',
  '50% na aprovação e 50% na entrega',
  'Cartão de crédito em até 3x',
  'Boleto bancário',
  'Pagamento na conclusão do serviço',
]
const EXECUTION_CHIPS = ['Imediato', '5 dias úteis', '10 dias úteis', '15 dias', '30 dias', 'A combinar']

function Chips({ options, onPick }: { options: (string | number)[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(String(o))}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function ClientSection({ client, onChange }: { client: QuoteClient; onChange: (c: QuoteClient) => void }) {
  const clients = useStore((s) => s.clients)
  const saveClient = useStore((s) => s.saveClient)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const linked = client.clientId ? clients.find((c) => c.id === client.clientId) : undefined

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()
    return clients
      .filter((c) => !q || `${c.name} ${c.document} ${c.email}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 8)
  }, [clients, query])

  const differsFromSaved =
    linked && JSON.stringify(clientToQuoteClient(linked)) !== JSON.stringify({ ...client, clientId: linked.id })

  function saveAsClient() {
    if (!client.name.trim()) return toast('Informe o nome do cliente', 'error')
    const base = linked ?? newClient()
    const saved = {
      ...base,
      name: client.name,
      docType: client.docType,
      document: client.document,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      address: { ...client.address },
    }
    saveClient(saved)
    onChange({ ...client, clientId: saved.id })
    toast(linked ? 'Cadastro do cliente atualizado' : 'Cliente salvo no cadastro')
  }

  return (
    <Card>
      <CardHeader
        icon={<UserRound size={18} />}
        title="Cliente"
        actions={
          <>
            {linked && (
              <Link
                to={`/clientes/${linked.id}`}
                title="Ver cliente e histórico de orçamentos"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
              >
                <CheckCircle2 size={14} /> Cadastrado · ver histórico
              </Link>
            )}
            {client.name && (
              <Button size="sm" variant="ghost" onClick={() => onChange(emptyQuoteClient())}>
                <X size={14} /> Limpar
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        {clients.length > 0 && (
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder={`Buscar entre ${clients.length} cliente${clients.length > 1 ? 's' : ''} cadastrado${clients.length > 1 ? 's' : ''}…`}
              value={query}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
            />
            {open && results.length > 0 && (
              <ul className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-50"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onChange(clientToQuoteClient(c))
                        setQuery('')
                        setOpen(false)
                      }}
                    >
                      <span className="text-sm font-medium text-slate-900">{c.name}</span>
                      <span className="text-xs text-slate-500">
                        {[c.document, c.phone, c.email].filter(Boolean).join(' · ') || 'Sem contato'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ClientFields value={client} onChange={onChange} />

        {client.name.trim() && (!linked || differsFromSaved) && (
          <Button size="sm" variant="subtle" onClick={saveAsClient}>
            <UserPlus size={14} /> {linked ? 'Atualizar cadastro do cliente' : 'Salvar no cadastro de clientes'}
          </Button>
        )}
      </div>
    </Card>
  )
}

export function QuoteEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const quote = useStore((s) => s.quotes.find((q) => q.id === id))
  const profiles = useStore((s) => s.profiles)
  const updateQuote = useStore((s) => s.updateQuote)
  const deleteQuote = useStore((s) => s.deleteQuote)
  const duplicateQuote = useStore((s) => s.duplicateQuote)
  const [busy, setBusy] = useState<'download' | 'preview' | null>(null)
  const [newExtraId, setNewExtraId] = useState<string | null>(null)

  if (!quote) {
    return (
      <EmptyState
        title="Orçamento não encontrado"
        description="Ele pode ter sido excluído."
        action={<Button onClick={() => navigate('/')}>Voltar para orçamentos</Button>}
      />
    )
  }

  const q = quote
  const profile = profiles.find((p) => p.id === q.profileId)
  const totals = quoteTotals(q)
  const itemCount = q.items.filter((i) => i.description.trim()).length
  const set = (patch: Partial<Quote>) => updateQuote(q.id, patch)
  const validityDays =
    parseDate(q.validUntil) && parseDate(q.issueDate)
      ? differenceInCalendarDays(parseDate(q.validUntil)!, parseDate(q.issueDate)!)
      : null

  function changeIssueDate(iso: string) {
    // Mantém a mesma duração de validade ao mudar a emissão
    const days = validityDays ?? profile?.defaultValidityDays ?? 15
    set({ issueDate: iso, validUntil: toISODate(addDays(parseDate(iso)!, Math.max(days, 0))) })
  }

  function checkReady() {
    if (!profile) {
      toast('Selecione a empresa emissora', 'error')
      return false
    }
    if (!q.items.some((it) => it.description.trim())) {
      toast('Adicione ao menos um item com descrição', 'error')
      return false
    }
    return true
  }

  async function handleDownload() {
    if (!checkReady()) return
    setBusy('download')
    try {
      await downloadQuotePdf(q, profile!)
      if (q.status === 'rascunho') {
        toast('PDF gerado. Marque como “Enviado” quando mandar ao cliente.')
      } else toast('PDF gerado')
    } catch (e) {
      console.error(e)
      toast('Não foi possível gerar o PDF', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handlePreview() {
    if (!checkReady()) return
    // Abre a aba antes do await para não ser bloqueada como pop-up
    const win = window.open('', '_blank')
    setBusy('preview')
    try {
      const blob = await renderQuotePdf(q, profile!)
      const url = URL.createObjectURL(blob)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (e) {
      console.error(e)
      win?.close()
      toast('Não foi possível gerar o PDF', 'error')
    } finally {
      setBusy(null)
    }
  }

  const pdfButtons = (
    <>
      <Button onClick={handlePreview} disabled={!!busy} className="hidden sm:inline-flex">
        {busy === 'preview' ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <Eye size={16} />} Visualizar
      </Button>
      <Button variant="primary" onClick={handleDownload} disabled={!!busy}>
        {busy === 'download' ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <Download size={16} />}{' '}
        Baixar PDF
      </Button>
    </>
  )

  return (
    <>
      <button
        onClick={() => navigate('/')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Orçamentos
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Orçamento <span className="font-mono text-xl text-slate-500">{q.number}</span>
          </h1>
          <div className="w-32">
            <Select
              aria-label="Status"
              value={q.status}
              onChange={(e) => set({ status: e.target.value as QuoteStatus })}
              className={cn(
                'h-8 rounded-full border-0 py-0 pr-7 pl-3 text-xs font-semibold',
                STATUS[q.status].className,
              )}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </Select>
          </div>
          <span className="text-xs text-slate-400">Salvo automaticamente</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="Duplicar"
            aria-label="Duplicar orçamento"
            onClick={() => {
              const newId = duplicateQuote(q.id)
              if (newId) {
                toast('Orçamento duplicado')
                navigate(`/orcamentos/${newId}`)
              }
            }}
          >
            <Copy size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Excluir"
            aria-label="Excluir orçamento"
            className="hover:text-red-600"
            onClick={() => {
              if (window.confirm(`Excluir o orçamento ${q.number}?`)) {
                deleteQuote(q.id)
                toast('Orçamento excluído')
                navigate('/')
              }
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Dados gerais */}
        <Card>
          <CardHeader icon={<CalendarRange size={18} />} title="Dados gerais" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="Empresa emissora">
              <Select value={q.profileId} onChange={(e) => set({ profileId: e.target.value })}>
                {!profile && <option value={q.profileId}>— selecione —</option>}
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.tradeName || p.legalName}
                  </option>
                ))}
              </Select>
            </Field>
            <TextField
              label="Título / referência"
              hint="Opcional. Ex.: Reforma do banheiro social"
              value={q.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            <Field label="Data de emissão">
              <DateField value={q.issueDate} onChange={changeIssueDate} />
            </Field>
            <Field
              label="Válido até"
              hint={
                validityDays !== null && validityDays >= 0
                  ? `${validityDays} dia${validityDays === 1 ? '' : 's'} após a emissão · ${formatDateLong(q.validUntil)}`
                  : 'A validade deve ser posterior à emissão'
              }
            >
              <DateField
                value={q.validUntil}
                minDate={q.issueDate}
                referenceDate={q.issueDate}
                onChange={(validUntil) => set({ validUntil })}
              />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {VALIDITY_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ validUntil: toISODate(addDays(parseDate(q.issueDate)!, d)) })}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                      validityDays === d
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50',
                    )}
                  >
                    {d} dias
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <ClientSection client={q.client} onChange={(client) => set({ client })} />

        {/* Itens */}
        <Card>
          <CardHeader
            icon={<ListChecks size={18} />}
            title="Itens do orçamento"
            actions={
              <span className="text-sm text-slate-500">
                Subtotal <strong className="text-slate-900 tabular-nums">{formatCurrency(totals.subtotal)}</strong>
              </span>
            }
          />
          <div className="pt-3">
            <ItemsEditor items={q.items} onChange={(items) => set({ items })} />
          </div>
        </Card>

        {/* Resumo / totais */}
        <Card>
          <CardHeader icon={<Receipt size={18} />} title="Descontos, acréscimos e total" />
          <div className="grid gap-6 p-4 sm:p-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Desconto</span>
                  <Segmented
                    size="sm"
                    ariaLabel="Tipo de desconto"
                    value={q.discount.type}
                    onChange={(type) => set({ discount: { type, value: 0 } })}
                    options={[
                      { value: 'percent', label: '%' },
                      { value: 'value', label: 'R$' },
                    ]}
                  />
                </div>
                <NumberInput
                  aria-label="Desconto"
                  currency={q.discount.type === 'value'}
                  suffix={q.discount.type === 'percent' ? '%' : undefined}
                  value={q.discount.value}
                  onValueChange={(value) => set({ discount: { ...q.discount, value } })}
                />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Acréscimos</span>
                <div className="space-y-2">
                  {q.extras.map((ex) => (
                    <div key={ex.id} className="flex gap-1.5">
                      <Input
                        className="min-w-0 flex-1"
                        autoFocus={ex.id === newExtraId}
                        placeholder="Ex.: Deslocamento"
                        aria-label="Descrição do acréscimo"
                        value={ex.label}
                        onChange={(e) =>
                          set({ extras: q.extras.map((x) => (x.id === ex.id ? { ...x, label: e.target.value } : x)) })
                        }
                      />
                      <div className="w-36 shrink-0">
                        <NumberInput
                          currency
                          aria-label="Valor do acréscimo"
                          value={ex.value}
                          onValueChange={(value) =>
                            set({ extras: q.extras.map((x) => (x.id === ex.id ? { ...x, value } : x)) })
                          }
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10"
                        aria-label="Remover acréscimo"
                        onClick={() => set({ extras: q.extras.filter((x) => x.id !== ex.id) })}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const extra = { id: uid(), label: '', value: 0 }
                      setNewExtraId(extra.id)
                      set({ extras: [...q.extras, extra] })
                    }}
                  >
                    <Plus size={14} /> Adicionar acréscimo (frete, deslocamento…)
                  </Button>
                </div>
              </div>
            </div>

            <dl className="space-y-2 self-end rounded-lg bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'itens'})
                </dt>
                <dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd>
              </div>
              {totals.discountValue > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Desconto</dt>
                  <dd className="tabular-nums">− {formatCurrency(totals.discountValue)}</dd>
                </div>
              )}
              {q.extras
                .filter((e) => e.value)
                .map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <dt className="text-slate-500">{e.label || 'Acréscimo'}</dt>
                    <dd className="tabular-nums">{formatCurrency(e.value)}</dd>
                  </div>
                ))}
              <div className="flex items-end justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-700">Total</dt>
                <dd className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {formatCurrency(totals.total)}
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        {/* Condições */}
        <Card>
          <CardHeader icon={<ClipboardList size={18} />} title="Condições e observações" />
          <div className="grid gap-5 p-4 sm:p-5">
            <Field label="Forma de pagamento">
              <Textarea
                rows={2}
                placeholder="Como o cliente vai pagar?"
                value={q.paymentTerms}
                onChange={(e) => set({ paymentTerms: e.target.value })}
              />
              <Chips options={PAYMENT_CHIPS} onPick={(v) => set({ paymentTerms: v })} />
            </Field>
            <Field label="Prazo de execução">
              <Input
                placeholder="Ex.: 10 dias úteis após aprovação"
                value={q.executionTime}
                onChange={(e) => set({ executionTime: e.target.value })}
              />
              <Chips options={EXECUTION_CHIPS} onPick={(v) => set({ executionTime: v })} />
            </Field>
            <Field label="Observações">
              <Textarea
                rows={3}
                placeholder="Garantia, materiais inclusos/não inclusos, condições gerais…"
                value={q.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Barra fixa no mobile/tablet */}
      <div className="h-16" aria-hidden />
      <div className="fixed inset-x-0 bottom-[57px] z-10 border-t border-slate-200 bg-white/95 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] text-slate-500">
              Total{q.client.name && <span className="hidden sm:inline"> · {q.client.name}</span>}
            </p>
            <p className="text-lg leading-tight font-bold text-slate-900 tabular-nums">
              {formatCurrency(totals.total)}
            </p>
          </div>
          <div className="flex gap-2">{pdfButtons}</div>
        </div>
      </div>
    </>
  )
}
