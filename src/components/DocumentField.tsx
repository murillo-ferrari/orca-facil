import { useId } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { DocType } from '../types'
import { isValidDoc, maskDoc, onlyDigits } from '../lib/format'
import { Field, Input, Segmented } from './ui'

export function DocumentField({
  docType,
  value,
  onChange,
  label = 'Documento',
  optional = false,
}: {
  docType: DocType
  value: string
  onChange: (docType: DocType, value: string) => void
  label?: string
  optional?: boolean
}) {
  const id = useId()
  const digits = onlyDigits(value)
  const complete = digits.length === (docType === 'CPF' ? 11 : 14)
  const valid = complete && isValidDoc(value, docType)
  const error = complete && !valid ? `${docType} inválido — confira os dígitos` : undefined

  return (
    <Field
      htmlFor={id}
      label={
        <span className="flex items-center justify-between gap-2">
          <span>
            {label}
            {optional && <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
          </span>
          <Segmented
            size="sm"
            ariaLabel="Tipo de documento"
            value={docType}
            options={[
              { value: 'CPF', label: 'CPF' },
              { value: 'CNPJ', label: 'CNPJ' },
            ]}
            onChange={(t) => onChange(t, maskDoc(value, t))}
          />
        </span>
      }
      error={error}
    >
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(docType, maskDoc(e.target.value, docType))}
        />
        {valid && <CheckCircle2 size={16} className="absolute top-1/2 right-3 -translate-y-1/2 text-emerald-500" />}
      </div>
    </Field>
  )
}
