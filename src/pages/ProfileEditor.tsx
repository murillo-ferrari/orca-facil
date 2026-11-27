import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CreditCard, Crown, FileCog, MapPin, Phone, Save, Trash2 } from 'lucide-react'
import { useStore } from '../store/store'
import { newProfile } from '../store/factories'
import type { CompanyProfile, PixKeyType } from '../types'
import { formatQuoteNumber } from '../store/factories'
import { maskDoc, maskPhone } from '../lib/format'
import { AddressFields } from '../components/AddressFields'
import { DocumentField } from '../components/DocumentField'
import { NumberInput } from '../components/NumberInput'
import { BrandingCard } from '../components/BrandingCard'
import {
  Button,
  Card,
  CardHeader,
  CardSkeleton,
  Field,
  PageHeader,
  Select,
  Textarea,
  TextField,
} from '../components/ui'
import { toast } from '../components/toast'
import { confirmDialog } from '../components/confirm'

const PIX_TYPES: PixKeyType[] = ['CNPJ', 'CPF', 'E-mail', 'Telefone', 'Aleatória']
const NO_BRANDING = { logo: null, accent: null }

// Logotipo e cores do PDF são do plano Pro: na Cloud o cartão decide pelo plano; na Local mostra só o convite
const BrandingSection =
  import.meta.env.VITE_EDITION === 'cloud' ? lazy(() => import('../editions/cloud/billing/BrandingSection')) : null

export function ProfileEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useStore((s) => s.profiles.find((p) => p.id === id))
  const saveProfile = useStore((s) => s.saveProfile)
  const deleteProfile = useStore((s) => s.deleteProfile)
  const quoteCount = useStore((s) => s.quotes.filter((q) => q.profileId === id).length)
  const isNew = !existing
  const [p, setP] = useState<CompanyProfile>(() => (existing ? structuredClone(existing) : newProfile()))
  const [tried, setTried] = useState(false)

  const set = (patch: Partial<CompanyProfile>) => setP((prev) => ({ ...prev, ...patch }))
  const setBank = (patch: Partial<CompanyProfile['bank']>) =>
    setP((prev) => ({ ...prev, bank: { ...prev.bank, ...patch } }))

  const nameMissing = !p.tradeName.trim() && !p.legalName.trim()
  const companyName = p.tradeName.trim() || p.legalName.trim() || 'Sua empresa'

  function handleSave() {
    setTried(true)
    if (nameMissing) {
      window.scrollTo({
        top: 0,
        // Respeita a preferência de movimento reduzido do sistema
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
      return
    }
    saveProfile({ ...p, label: p.label.trim() || p.tradeName.trim() || p.legalName.trim() })
    toast(isNew ? 'Empresa cadastrada' : 'Alterações salvas')
    navigate('/empresas')
  }

  async function handleDelete() {
    const message = quoteCount
      ? `Esta empresa possui ${quoteCount} orçamento(s). Eles continuarão salvos, mas sem os dados da empresa. Excluir mesmo assim?`
      : 'Excluir esta empresa?'
    if (!(await confirmDialog({ title: 'Excluir empresa', message, confirmLabel: 'Excluir', danger: true }))) return
    deleteProfile(p.id)
    toast('Empresa excluída')
    navigate('/empresas')
  }

  return (
    <>
      <button
        onClick={() => navigate('/empresas')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Empresas
      </button>
      <PageHeader
        title={isNew ? 'Nova empresa' : p.label || p.tradeName || 'Editar empresa'}
        description="Esses dados aparecem no cabeçalho e no rodapé dos seus orçamentos."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader icon={<Building2 size={18} />} title="Identificação" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <DocumentField
              label="CPF / CNPJ"
              docType={p.docType}
              value={p.document}
              onChange={(docType, document) =>
                set({
                  docType,
                  document,
                  pixKeyType: p.pixKeyType === 'CPF' || p.pixKeyType === 'CNPJ' ? docType : p.pixKeyType,
                })
              }
            />
            <TextField
              label="Apelido do perfil"
              hint="Como aparece no seletor do app. Ex.: “Elétrica — PJ”"
              value={p.label}
              onChange={(e) => set({ label: e.target.value })}
            />
            <TextField
              label="Nome fantasia"
              value={p.tradeName}
              onChange={(e) => set({ tradeName: e.target.value })}
              error={tried && nameMissing ? 'Informe o nome fantasia ou a razão social' : undefined}
            />
            <TextField
              label={p.docType === 'CNPJ' ? 'Razão social' : 'Nome completo'}
              autoComplete={p.docType === 'CNPJ' ? 'organization' : 'name'}
              value={p.legalName}
              onChange={(e) => set({ legalName: e.target.value })}
            />
            <TextField
              label="Inscrição estadual"
              hint="Opcional"
              value={p.stateRegistration}
              onChange={(e) => set({ stateRegistration: e.target.value })}
            />
            <TextField
              label="Inscrição municipal"
              hint="Opcional"
              value={p.municipalRegistration}
              onChange={(e) => set({ municipalRegistration: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <CardHeader icon={<MapPin size={18} />} title="Endereço" />
          <div className="p-4 sm:p-5">
            <AddressFields ownData value={p.address} onChange={(address) => set({ address })} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Phone size={18} />} title="Contatos" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <TextField
              label="Telefone"
              inputMode="tel"
              placeholder="(00) 0000-0000"
              autoComplete="tel"
              value={p.phone}
              onChange={(e) => set({ phone: maskPhone(e.target.value) })}
            />
            <TextField
              label="WhatsApp"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              value={p.whatsapp}
              onChange={(e) => set({ whatsapp: maskPhone(e.target.value) })}
            />
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              value={p.email}
              onChange={(e) => set({ email: e.target.value })}
            />
            <TextField
              label="Site / Instagram"
              autoComplete="url"
              value={p.website}
              onChange={(e) => set({ website: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<CreditCard size={18} />}
            title="Dados para pagamento"
            description="Opcional. Quando preenchidos, saem no PDF."
          />
          <div className="grid gap-4 p-4 sm:grid-cols-6 sm:p-5">
            <Field label="Tipo da chave PIX" className="sm:col-span-2">
              <Select
                value={p.pixKeyType}
                onChange={(e) => {
                  const pixKeyType = e.target.value as PixKeyType
                  set({ pixKeyType, pixKey: pixKeyType === p.docType ? p.document : p.pixKey })
                }}
              >
                {PIX_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <TextField
              label="Chave PIX"
              className="sm:col-span-4"
              value={p.pixKey}
              onChange={(e) => {
                const v = e.target.value
                const masked =
                  p.pixKeyType === 'CPF' || p.pixKeyType === 'CNPJ'
                    ? maskDoc(v, p.pixKeyType)
                    : p.pixKeyType === 'Telefone'
                      ? maskPhone(v)
                      : v
                set({ pixKey: masked })
              }}
            />
            <TextField
              label="Banco"
              className="sm:col-span-3"
              placeholder="Ex.: 260 - Nu Pagamentos"
              value={p.bank.bank}
              onChange={(e) => setBank({ bank: e.target.value })}
            />
            <TextField
              label="Agência"
              className="sm:col-span-1"
              value={p.bank.agency}
              onChange={(e) => setBank({ agency: e.target.value })}
            />
            <TextField
              label="Conta"
              className="sm:col-span-2"
              value={p.bank.account}
              onChange={(e) => setBank({ account: e.target.value })}
            />
            <Field label="Tipo de conta" className="sm:col-span-2">
              <Select
                value={p.bank.accountType}
                onChange={(e) => setBank({ accountType: e.target.value as CompanyProfile['bank']['accountType'] })}
              >
                <option>Corrente</option>
                <option>Poupança</option>
                <option>Pagamento</option>
              </Select>
            </Field>
            <TextField
              label="Titular"
              className="sm:col-span-4"
              value={p.bank.holder}
              onChange={(e) => setBank({ holder: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-6">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                checked={p.showBankInfo}
                onChange={(e) => set({ showBankInfo: e.target.checked })}
              />
              Exibir dados bancários no PDF
            </label>
          </div>
        </Card>

        {BrandingSection ? (
          <Suspense fallback={<CardSkeleton lines={1} className="h-[180px]" />}>
            <BrandingSection
              value={p.branding ?? NO_BRANDING}
              onChange={(branding) => set({ branding })}
              companyName={companyName}
            />
          </Suspense>
        ) : (
          <BrandingCard
            locked
            value={p.branding ?? NO_BRANDING}
            onChange={(branding) => set({ branding })}
            companyName={companyName}
            upgrade={
              // ../ = raiz do site (a Local fica em /gratis/, ao lado da página do plano Pro)
              <a
                href="../"
                className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-brand-50 px-3.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                <Crown size={16} aria-hidden /> Conhecer o plano Pro
              </a>
            }
          />
        )}

        <Card>
          <CardHeader
            icon={<FileCog size={18} />}
            title="Padrões dos orçamentos"
            description="Preenchidos automaticamente em cada novo orçamento desta empresa."
          />
          <div className="grid gap-4 p-4 sm:grid-cols-6 sm:p-5">
            <Field label="Validade padrão" className="sm:col-span-2">
              <NumberInput
                value={p.defaultValidityDays}
                decimals={0}
                suffix="dias"
                onValueChange={(v) => set({ defaultValidityDays: Math.max(0, Math.round(v)) })}
              />
            </Field>
            <TextField
              label="Prefixo da numeração"
              className="sm:col-span-2"
              value={p.numberPrefix}
              onChange={(e) => set({ numberPrefix: e.target.value })}
            />
            <Field
              label="Próximo número"
              className="sm:col-span-2"
              hint={`Próximo: ${formatQuoteNumber(p.numberPrefix, p.nextNumber)}`}
            >
              <NumberInput
                value={p.nextNumber}
                decimals={0}
                onValueChange={(v) => set({ nextNumber: Math.max(1, Math.round(v)) })}
              />
            </Field>
            <Field label="Forma de pagamento padrão" className="sm:col-span-3">
              <Textarea
                rows={3}
                placeholder="Ex.: 50% na aprovação e 50% na entrega, via PIX."
                value={p.defaultPaymentTerms}
                onChange={(e) => set({ defaultPaymentTerms: e.target.value })}
              />
            </Field>
            <Field label="Observações padrão" className="sm:col-span-3">
              <Textarea
                rows={3}
                placeholder="Ex.: Materiais não inclusos. Garantia de 90 dias."
                value={p.defaultNotes}
                onChange={(e) => set({ defaultNotes: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Barra fixa no rodapé, igual à do editor de orçamento */}
      <div className="h-16" aria-hidden />
      <div className="fixed inset-x-0 bottom-[57px] z-10 border-t border-slate-200 bg-white/95 backdrop-blur lg:bottom-0 lg:left-64 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          {!isNew ? (
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 size={16} /> <span className="hidden sm:inline">Excluir</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/empresas')}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave}>
              <Save size={16} /> Salvar empresa
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
