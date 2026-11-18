import type { Address, DocType } from '../types'
import { maskPhone } from '../lib/format'
import { AddressFields } from './AddressFields'
import { DocumentField } from './DocumentField'
import { TextField } from './ui'

export interface ClientLike {
  name: string
  docType: DocType
  document: string
  contactName: string
  email: string
  phone: string
  address: Address
}

export function ClientFields<T extends ClientLike>({
  value,
  onChange,
  nameError,
  autoFocus,
}: {
  value: T
  onChange: (v: T) => void
  nameError?: string
  autoFocus?: boolean
}) {
  const set = (patch: Partial<ClientLike>) => onChange({ ...value, ...patch })
  return (
    // Dados de terceiros: sem preenchimento automático, para o navegador não colocar os dados do próprio usuário
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nome / Razão social"
          autoFocus={autoFocus}
          value={value.name}
          autoComplete="off"
          error={nameError}
          onChange={(e) => set({ name: e.target.value })}
        />
        <DocumentField
          label="CPF / CNPJ"
          optional
          docType={value.docType}
          value={value.document}
          onChange={(docType, document) => set({ docType, document })}
        />
        <TextField
          label="Pessoa de contato"
          hint="Opcional"
          value={value.contactName}
          autoComplete="off"
          onChange={(e) => set({ contactName: e.target.value })}
        />
        <TextField
          label="Telefone / WhatsApp"
          inputMode="tel"
          value={value.phone}
          autoComplete="off"
          onChange={(e) => set({ phone: maskPhone(e.target.value) })}
        />
        <TextField
          label="E-mail"
          type="email"
          className="sm:col-span-2"
          value={value.email}
          autoComplete="off"
          onChange={(e) => set({ email: e.target.value })}
        />
      </div>
      <details className="group rounded-lg border border-slate-200 px-3 py-2 open:pb-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 select-none">
          <span className="mr-1 inline-block group-open:rotate-90 motion-safe:transition">›</span> Endereço
          {value.address.city && (
            <span className="ml-2 font-normal text-slate-400">
              {value.address.city}
              {value.address.state && `/${value.address.state}`}
            </span>
          )}
        </summary>
        <div className="mt-3">
          <AddressFields value={value.address} onChange={(address) => set({ address })} />
        </div>
      </details>
    </div>
  )
}
