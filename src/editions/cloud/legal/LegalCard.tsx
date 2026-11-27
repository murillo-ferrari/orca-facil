import { ExternalLink, Scale } from 'lucide-react'
import { Card, CardHeader } from '../../../components/ui'

const DOCS = [
  { to: '/termos', label: 'Termos de Uso', hint: 'Regras do serviço, do plano Pro e do cancelamento.' },
  {
    to: '/privacidade',
    label: 'Política de Privacidade',
    hint: 'Quais dados guardamos, para quê e como exercer seus direitos (LGPD).',
  },
]

/**
 * Ajustes › Outros (edição Cloud): atalho para os documentos legais, que só apareciam antes do login. Abrem em outra
 * aba: a navegação normal desmontaria o app logado (e a sincronização) para mostrar uma página pública.
 */
export default function LegalCard() {
  return (
    <Card>
      <CardHeader icon={<Scale size={18} />} title="Termos e privacidade" />
      <ul className="divide-y divide-slate-100">
        {DOCS.map((d) => (
          <li key={d.to}>
            <a
              href={d.to}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 sm:px-5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">
                  {d.label}
                  <span className="sr-only"> (abre em nova aba)</span>
                </span>
                <span className="block text-sm text-slate-500">{d.hint}</span>
              </span>
              <ExternalLink size={16} className="shrink-0 text-slate-400" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  )
}
