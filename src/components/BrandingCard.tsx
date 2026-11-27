import { useId, useRef, useState, type ReactNode } from 'react'
import { Check, Crown, ImagePlus, Palette, Trash2 } from 'lucide-react'
import type { Branding } from '../types'
import { PALETTE, isHex, readableAccent } from '../lib/color'
import { LogoError, prepareLogo } from '../lib/logo'
import { cn } from './styles'
import { toast } from './toast'
import { Badge, Button, Card, CardHeader } from './ui'

const DEFAULT_INK = '#0f172a'
const SAMPLE_ACCENT = '#1d4ed8'

/** Miniatura do cabeçalho do PDF com a aparência escolhida (decorativa: o que importa está nos controles). */
function Preview({ logo, accent, name }: { logo: string | null; accent: string | null; name: string }) {
  const color = accent ? readableAccent(accent) : DEFAULT_INK
  return (
    <div aria-hidden className="rounded-lg border border-slate-200 bg-white p-3 text-[10px] text-slate-600 select-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {logo && <img src={logo} alt="" className="mb-1.5 h-9 max-w-32 object-contain object-left" />}
          <p className="truncate text-sm font-bold text-slate-900">{name}</p>
        </div>
        <p className="shrink-0 text-xs font-bold tracking-widest" style={{ color }}>
          ORÇAMENTO
        </p>
      </div>
      <div className="my-2 border-b-2" style={{ borderColor: color }} />
      <div
        className="flex justify-between px-1.5 py-1 font-bold uppercase"
        style={accent ? { background: color, color: '#fff' } : { background: '#f1f5f9', color: '#64748b' }}
      >
        <span>Descrição</span>
        <span>Total</span>
      </div>
      <div className="flex justify-between border-b border-slate-200 px-1.5 py-1">
        <span>Pintura da sala</span>
        <span>R$ 1.200,00</span>
      </div>
      <div className="mt-2 flex justify-between border-t-2 pt-1.5 font-bold" style={{ borderColor: color }}>
        <span className="text-slate-900">Total</span>
        <span style={{ color }}>R$ 1.200,00</span>
      </div>
    </div>
  )
}

interface Props {
  value: Branding
  onChange: (value: Branding) => void
  /** Nome que aparece na miniatura */
  companyName: string
  /** Sem Pro: mostra só uma amostra e o convite (`upgrade`) */
  locked?: boolean
  upgrade?: ReactNode
}

/**
 * "Logotipo e cores do PDF" no cadastro da empresa (recurso do plano Pro). Escolhe-se o logotipo (reduzido no próprio
 * navegador) e uma cor de destaque; a miniatura mostra o resultado na hora.
 */
export function BrandingCard({ value, onChange, companyName, locked, upgrade }: Props) {
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { logo, accent } = value
  const isCustom = !!accent && !PALETTE.some((c) => c.hex === accent)
  const adjusted = !!accent && isHex(accent) && readableAccent(accent) !== accent

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onChange({ ...value, logo: await prepareLogo(file) })
    } catch (e) {
      toast(e instanceof LogoError ? e.message : 'Não foi possível usar esta imagem.', 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = '' // permite escolher o mesmo arquivo de novo
    }
  }

  const header = (
    <CardHeader
      icon={<Palette size={18} />}
      title="Logotipo e cores do PDF"
      description="Deixe o orçamento com a cara da sua empresa."
      actions={
        <Badge className="gap-1 bg-brand-50 text-brand-700">
          <Crown size={12} aria-hidden /> Pro
        </Badge>
      }
    />
  )

  if (locked) {
    return (
      <Card>
        {header}
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="flex flex-col justify-center gap-3">
            <p className="text-sm text-slate-600">
              No plano Pro você coloca o logotipo da empresa e a cor da sua marca no PDF dos orçamentos.
            </p>
            {(logo || accent) && (
              <p className="text-sm text-slate-500">
                O logotipo e a cor que você já escolheu continuam salvos e voltam a aparecer no PDF quando o Pro estiver
                ativo.
              </p>
            )}
            {upgrade}
          </div>
          <Preview logo={null} accent={SAMPLE_ACCENT} name={companyName} />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {header}
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <p id={`${id}-logo`} className="text-sm font-medium text-slate-700">
              Logotipo
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                name="logotipo"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-labelledby={`${id}-logo`}
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={busy} aria-describedby={`${id}-logo-dica`}>
                <ImagePlus size={16} aria-hidden />{' '}
                {busy ? 'Processando…' : logo ? 'Trocar logotipo' : 'Enviar logotipo'}
              </Button>
              {logo && (
                <Button variant="ghost" onClick={() => onChange({ ...value, logo: null })}>
                  <Trash2 size={16} aria-hidden /> Remover
                </Button>
              )}
            </div>
            <p id={`${id}-logo-dica`} className="mt-1.5 text-xs text-slate-500">
              PNG, JPG ou WebP. Fundo transparente (PNG) fica melhor. A imagem é reduzida automaticamente.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Cor de destaque</legend>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <label className="relative">
                <input
                  type="radio"
                  name={`${id}-cor`}
                  className="peer sr-only"
                  checked={!accent}
                  onChange={() => onChange({ ...value, accent: null })}
                />
                <span className="flex h-6 items-center rounded-full border border-slate-300 px-4 text-sm text-slate-700 peer-checked:border-slate-900 peer-checked:ring-2 peer-checked:ring-slate-900 peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand-500">
                  Padrão
                </span>
              </label>
              {PALETTE.map((c) => (
                <label key={c.hex} className="relative">
                  <input
                    type="radio"
                    name={`${id}-cor`}
                    className="peer sr-only"
                    checked={accent === c.hex}
                    onChange={() => onChange({ ...value, accent: c.hex })}
                  />
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full forced-color-adjust-none peer-checked:ring-2 peer-checked:ring-slate-900 peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand-500"
                    style={{ background: c.hex }}
                  >
                    {accent === c.hex && <Check size={18} className="text-white" aria-hidden />}
                  </span>
                  <span className="sr-only">{c.name}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                Outra cor
                <input
                  type="color"
                  name="cor-personalizada"
                  value={isHex(accent) ? accent : SAMPLE_ACCENT}
                  onChange={(e) => onChange({ ...value, accent: e.target.value })}
                  className={cn(
                    'h-11 w-14 cursor-pointer rounded-lg border bg-white p-1',
                    isCustom ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2' : 'border-slate-300',
                  )}
                />
              </label>
            </div>
            <p role="status" className="mt-1.5 min-h-4 text-xs text-slate-500">
              {adjusted ? 'Escurecemos um pouco esta cor para o texto continuar legível no PDF.' : ''}
            </p>
          </fieldset>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Pré-visualização</p>
          <Preview logo={logo} accent={accent} name={companyName} />
        </div>
      </div>
    </Card>
  )
}
