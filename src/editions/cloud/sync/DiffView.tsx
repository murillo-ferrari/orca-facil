import { Minus, Plus } from 'lucide-react'
import { cn } from '../../../components/styles'
import { sideBySide, type DiffLine } from './conflicts'

/**
 * Diff lado a lado (jsdiff), no estilo dos editores de código: nuvem à esquerda em vermelho (o que sai), sua versão
 * à direita em verde (o que entra), com as palavras que mudaram em destaque.
 * A cor nunca é a única pista: cada linha marcada leva o ícone − ou + e o texto "removido"/"adicionado" para leitores
 * de tela (WCAG 1.4.1), e em modo de alto contraste (forced-colors) o sublinhado/tachado mantém a diferença.
 */

const KIND = {
  del: { bg: 'bg-red-50', mark: 'bg-red-200 text-red-950 forced-colors:underline', icon: Minus, sr: 'removido' },
  add: { bg: 'bg-green-50', mark: 'bg-green-200 text-green-950 forced-colors:underline', icon: Plus, sr: 'adicionado' },
} as const

function Line({ line }: { line: DiffLine }) {
  if (line.kind === 'same') {
    return (
      <div className="flex min-h-6 gap-2 px-2 py-0.5">
        <span className="w-3.5 shrink-0" aria-hidden="true" />
        <span className="whitespace-pre-wrap break-words">{line.segs[0].text}</span>
      </div>
    )
  }
  const k = KIND[line.kind]
  const Icon = k.icon
  return (
    <div className={cn('flex min-h-6 gap-2 px-2 py-0.5', k.bg)}>
      <Icon size={14} className="mt-0.5 shrink-0 text-slate-700" aria-hidden="true" />
      <span className="sr-only">{k.sr}: </span>
      <span className="whitespace-pre-wrap break-words text-slate-900">
        {line.segs.map((s, i) => (
          <span key={i} className={cn(s.hl && cn('rounded-sm px-0.5 font-medium', k.mark))}>
            {s.text}
          </span>
        ))}
      </span>
    </div>
  )
}

function Column({ title, lines, tone }: { title: string; lines: DiffLine[]; tone: 'del' | 'add' }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
      <div
        className={cn(
          'border-b border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800',
          tone === 'del' ? 'bg-red-100' : 'bg-green-100',
        )}
      >
        {title}
      </div>
      <div className="font-mono text-[13px] leading-5 text-slate-800">
        {lines.length ? (
          lines.map((l, i) => <Line key={i} line={l} />)
        ) : (
          <p className="px-2 py-1.5 font-sans text-sm text-slate-500">(vazio)</p>
        )}
      </div>
    </div>
  )
}

export function DiffView({
  serverLines,
  localLines,
  serverTitle = 'Na nuvem',
  localTitle = 'Sua versão',
}: {
  serverLines: string[]
  localLines: string[]
  serverTitle?: string
  localTitle?: string
}) {
  const { left, right } = sideBySide(serverLines, localLines)
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Column title={serverTitle} lines={left} tone="del" />
      <Column title={localTitle} lines={right} tone="add" />
    </div>
  )
}
