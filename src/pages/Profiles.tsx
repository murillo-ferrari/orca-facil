import { useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Mail, MapPin, Pencil, Phone, Plus } from 'lucide-react'
import { useStore } from '../store/store'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { formatAddressLines } from '../lib/format'

export function Profiles() {
  const profiles = useStore((s) => s.profiles)
  const activeId = useStore((s) => s.activeProfileId)
  const setActive = useStore((s) => s.setActiveProfile)
  const quotes = useStore((s) => s.quotes)
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Seus perfis de empresa. Cada orçamento usa os dados de um perfil."
        actions={
          <Button variant="primary" onClick={() => navigate('/empresas/nova')}>
            <Plus size={16} /> Nova empresa
          </Button>
        }
      />
      {profiles.length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} />}
          title="Nenhuma empresa cadastrada"
          description="Cadastre CPF/CNPJ, endereço, contatos e dados de pagamento uma única vez. Eles aparecem automaticamente em todos os orçamentos."
          action={
            <Button variant="primary" onClick={() => navigate('/empresas/nova')}>
              <Plus size={16} /> Cadastrar empresa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map((p) => {
            const isActive = p.id === activeId
            const count = quotes.filter((q) => q.profileId === p.id).length
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{p.label || p.tradeName || p.legalName}</h3>
                    {p.document && (
                      <p className="text-sm text-slate-500">
                        {p.docType} {p.document}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <Badge className="bg-emerald-50 text-emerald-700">
                      <CheckCircle2 size={12} className="mr-1" /> Ativa
                    </Badge>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {formatAddressLines(p.address)[0] && (
                    <li className="flex gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      {formatAddressLines(p.address).join(' — ')}
                    </li>
                  )}
                  {(p.phone || p.whatsapp) && (
                    <li className="flex gap-2">
                      <Phone size={14} className="mt-0.5 shrink-0 text-slate-400" /> {p.phone || p.whatsapp}
                    </li>
                  )}
                  {p.email && (
                    <li className="flex gap-2">
                      <Mail size={14} className="mt-0.5 shrink-0 text-slate-400" /> {p.email}
                    </li>
                  )}
                </ul>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">
                    {count} orçamento{count === 1 ? '' : 's'}
                  </span>
                  <div className="flex gap-2">
                    {!isActive && (
                      <Button size="sm" variant="ghost" onClick={() => setActive(p.id)}>
                        Usar esta
                      </Button>
                    )}
                    <Button size="sm" onClick={() => navigate(`/empresas/${p.id}`)}>
                      <Pencil size={14} /> Editar
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
