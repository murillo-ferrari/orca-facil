import { useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Address } from '../types'
import { maskCEP, onlyDigits } from '../lib/format'
import { lookupCep } from '../lib/cep'
import { Field, Input, Select, TextField } from './ui'
import { fieldMessageId } from './styles'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

/**
 * `ownData`: o endereço é do próprio usuário (perfil da empresa) e o navegador pode preenchê-lo
 * automaticamente. Para terceiros (clientes) o preenchimento fica desligado, senão o navegador
 * colocaria o endereço do usuário no cadastro do cliente.
 */
export function AddressFields({
  value,
  onChange,
  ownData = false,
}: {
  value: Address
  onChange: (a: Address) => void
  ownData?: boolean
}) {
  const ac = (token: string) => (ownData ? token : 'off')
  const [loading, setLoading] = useState(false)
  const [cepMsg, setCepMsg] = useState<string>()
  const numberRef = useRef<HTMLInputElement>(null)
  const cepId = useId()
  const ufId = useId()
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch })

  async function handleCep(raw: string) {
    const cep = maskCEP(raw)
    set({ cep })
    setCepMsg(undefined)
    if (onlyDigits(cep).length === 8) {
      setLoading(true)
      const r = await lookupCep(cep)
      setLoading(false)
      if (r) {
        onChange({ ...value, cep, ...r })
        numberRef.current?.focus()
      } else {
        setCepMsg('CEP não encontrado — preencha manualmente')
      }
    }
  }

  return (
    <div className="grid grid-cols-6 gap-3 sm:gap-4">
      <Field
        label="CEP"
        htmlFor={cepId}
        hint={cepMsg ?? 'Preenche o endereço automaticamente'}
        className="col-span-6 sm:col-span-2"
      >
        <div className="relative">
          <Input
            id={cepId}
            inputMode="numeric"
            placeholder="00000-000"
            autoComplete={ac('postal-code')}
            aria-describedby={fieldMessageId(cepId)}
            value={value.cep}
            onChange={(e) => handleCep(e.target.value)}
          />
          {loading && (
            <Loader2
              size={16}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 motion-safe:animate-spin"
            />
          )}
        </div>
      </Field>
      <TextField
        label="Logradouro"
        className="col-span-6 sm:col-span-4"
        value={value.street}
        onChange={(e) => set({ street: e.target.value })}
        autoComplete={ac('address-line1')}
        placeholder="Rua, avenida…"
      />
      <TextField
        ref={numberRef}
        label="Número"
        className="col-span-2"
        value={value.number}
        onChange={(e) => set({ number: e.target.value })}
        autoComplete="off"
      />
      <TextField
        label="Complemento"
        className="col-span-4"
        value={value.complement}
        onChange={(e) => set({ complement: e.target.value })}
        autoComplete={ac('address-line2')}
        placeholder="Sala, bloco…"
      />
      <TextField
        label="Bairro"
        className="col-span-6 sm:col-span-2"
        value={value.district}
        onChange={(e) => set({ district: e.target.value })}
        autoComplete={ac('address-level3')}
      />
      <TextField
        label="Cidade"
        className="col-span-4 sm:col-span-3"
        value={value.city}
        onChange={(e) => set({ city: e.target.value })}
        autoComplete={ac('address-level2')}
      />
      <Field label="UF" htmlFor={ufId} className="col-span-2 sm:col-span-1">
        <Select
          id={ufId}
          value={value.state}
          onChange={(e) => set({ state: e.target.value })}
          autoComplete={ac('address-level1')}
        >
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
