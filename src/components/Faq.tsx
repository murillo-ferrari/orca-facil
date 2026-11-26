import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from './ui'

/** Perguntas frequentes em `<details>` nativo (guia "accordion" do MWG): seta antes do texto, girada quando fechado. */
export function Faq({ items }: { items: [string, ReactNode][] }) {
  return (
    <Card className="divide-y divide-slate-100">
      {items.map(([q, a]) => (
        <details key={q} className="group px-4 sm:px-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3.5 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={16}
              aria-hidden
              className="shrink-0 -rotate-90 text-slate-400 group-open:rotate-0 motion-safe:transition-transform"
            />
            {q}
          </summary>
          <div className="pb-4 pl-6 text-sm text-slate-600">{a}</div>
        </details>
      ))}
    </Card>
  )
}
