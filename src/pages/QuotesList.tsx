import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Copy, Download, FileText, Loader2, Package, Plus, Search, Trash2, Users } from 'lucide-react'
import { useActiveProfile, useStore } from '../store/store'
import type { Quote, QuoteStatus } from '../types'
import { quoteTotals } from '../lib/calc'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import { STATUS, STATUS_ORDER } from '../lib/status'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, cn } from '../components/ui'
import { toast } from '../components/toast'
import { downloadQuotePdf } from '../pdf/exportPdf'

function Welcome() {
  const navigate = useNavigate()
  const steps = [
    {
      icon: Building2,
      title: 'Cadastre sua empresa',
      text: 'CPF ou CNPJ, endereço, contatos e PIX. Você pode ter mais de um perfil.',
    },
    {
      icon: FileText,
      title: 'Monte o orçamento',
      text: 'Itens com unidade, quantidade e preço, com totais automáticos.',
    },
    { icon: Download, title: 'Baixe o PDF', text: 'Um clique e o orçamento está pronto para enviar ao cliente.' },
  ]
  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Orçamentos profissionais em minutos</h1>
      <p className="mt-2 text-slate-600">
        Para começar, cadastre os dados da sua empresa. Eles ficam salvos neste navegador e entram automaticamente em
        todos os orçamentos.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <Card key={title} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {i + 1}
              </span>
              <Icon size={18} className="text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </Card>
        ))}
      </div>
      <Button variant="primary" size="lg" className="mt-8" onClick={() => navigate('/empresas/nova')}>
        <Building2 size={18} /> Cadastrar minha empresa
      </Button>
    </div>
  )
}

export function QuotesList() {
  const profiles = useStore((s) => s.profiles)
  const quotes = useStore((s) => s.quotes)
  const createQuote = useStore((s) => s.createQuote)
  const duplicateQuote = useStore((s) => s.duplicateQuote)
  const deleteQuote = useStore((s) => s.deleteQuote)
  const clientsCount = useStore((s) => s.clients.length)
  const catalogCount = useStore((s) => s.catalog.length)
  const active = useActiveProfile()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<QuoteStatus | 'todos'>('todos')
  const [scope, setScope] = useState<'ativa' | 'todas'>('ativa')
  const [downloading, setDownloading] = useState<string | null>(null)

  const today = todayISO()
  const scoped = useMemo(
    () => (scope === 'ativa' && active ? quotes.filter((q) => q.profileId === active.id) : quotes),
    [quotes, scope, active],
  )
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return scoped
      .filter((x) => status === 'todos' || x.status === status)
      .filter((x) => !q || `${x.number} ${x.client.name} ${x.title}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [scoped, query, status])

  const stats = useMemo(() => {
    const sum = (st: QuoteStatus) =>
      scoped.filter((q) => q.status === st).reduce((acc, q) => acc + quoteTotals(q).total, 0)
    return { open: sum('enviado'), approved: sum('aprovado') }
  }, [scoped])

  if (!profiles.length) return <Welcome />

  function handleNew() {
    if (!active) return
    const id = createQuote(active.id)
    if (id) navigate(`/orcamentos/${id}`)
  }

  async function handleDownload(q: Quote) {
    const profile = profiles.find((p) => p.id === q.profileId)
    if (!profile) return toast('A empresa deste orçamento foi excluída', 'error')
    setDownloading(q.id)
    try {
      await downloadQuotePdf(q, profile)
    } catch (e) {
      console.error(e)
      toast('Não foi possível gerar o PDF', 'error')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description={active ? `Emitindo como ${active.label || active.tradeName}` : undefined}
        actions={
          <Button variant="primary" size="lg" onClick={handleNew}>
            <Plus size={18} /> Novo orçamento
          </Button>
        }
      />

      {quotes.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Orçamentos</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{scoped.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Aguardando resposta</p>
            <p className="mt-1 text-xl font-semibold text-amber-600 tabular-nums">{formatCurrency(stats.open)}</p>
          </Card>
          <Card className="col-span-2 p-4 sm:col-span-1">
            <p className="text-xs font-medium text-slate-500">Aprovados</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600 tabular-nums">{formatCurrency(stats.approved)}</p>
          </Card>
        </div>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="Nenhum orçamento ainda"
          description={
            <>
              Crie o primeiro agora.{' '}
              {(!clientsCount || !catalogCount) &&
                'Dica: cadastrar clientes e serviços frequentes deixa o preenchimento ainda mais rápido.'}
            </>
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={handleNew}>
                <Plus size={16} /> Criar orçamento
              </Button>
              {!catalogCount && (
                <Button onClick={() => navigate('/servicos')}>
                  <Package size={16} /> Cadastrar serviços
                </Button>
              )}
              {!clientsCount && (
                <Button onClick={() => navigate('/clientes')}>
                  <Users size={16} /> Cadastrar clientes
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar nº, cliente ou título…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {(['todos', ...STATUS_ORDER] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm whitespace-nowrap transition',
                    status === st
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  )}
                >
                  {st === 'todos' ? 'Todos' : STATUS[st].label}
                </button>
              ))}
            </div>
            {profiles.length > 1 && (
              <div className="sm:ml-auto">
                <Segmented
                  size="sm"
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: 'ativa', label: 'Empresa ativa' },
                    { value: 'todas', label: 'Todas' },
                  ]}
                />
              </div>
            )}
          </div>

          <Card className="divide-y divide-slate-100 overflow-hidden">
            {filtered.map((q) => {
              const total = quoteTotals(q).total
              const expired = q.validUntil < today && (q.status === 'rascunho' || q.status === 'enviado')
              const profile = profiles.find((p) => p.id === q.profileId)
              return (
                <div
                  key={q.id}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5"
                  onClick={() => navigate(`/orcamentos/${q.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{q.number}</span>
                      <Badge className={STATUS[q.status].className}>{STATUS[q.status].label}</Badge>
                      {expired && <Badge className="bg-red-50 text-red-600">Vencido</Badge>}
                    </div>
                    <p className="mt-0.5 truncate font-medium text-slate-900">
                      {q.client.name || <span className="text-slate-400">Sem cliente</span>}
                      {q.title && <span className="font-normal text-slate-500"> · {q.title}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(q.issueDate)} · válido até {formatDate(q.validUntil)}
                      {scope === 'todas' && profile && ` · ${profile.label || profile.tradeName}`}
                    </p>
                  </div>
                  <p className="text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(total)}</p>
                  <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Baixar PDF"
                      title="Baixar PDF"
                      onClick={() => handleDownload(q)}
                    >
                      {downloading === q.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Duplicar"
                      title="Duplicar"
                      className="hidden sm:inline-flex"
                      onClick={() => {
                        const id = duplicateQuote(q.id)
                        if (id) {
                          toast('Orçamento duplicado')
                          navigate(`/orcamentos/${id}`)
                        }
                      }}
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      title="Excluir"
                      className="hidden hover:text-red-600 sm:inline-flex"
                      onClick={() => {
                        if (window.confirm(`Excluir o orçamento ${q.number}?`)) {
                          deleteQuote(q.id)
                          toast('Orçamento excluído')
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum orçamento encontrado.</p>
            )}
          </Card>
        </>
      )}
    </>
  )
}
