import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { cn } from '../../../components/styles'

/**
 * Topo das páginas públicas (landing, Termos, Privacidade). A faixa branca ocupa a largura toda e fica fixa ao
 * rolar; só o conteúdo fica no container. Altura fixa (h-16), para a barra não mudar de tamanho entre as páginas.
 * Ao rolar, ganha uma linha e uma sombra suaves: mostram que o conteúdo passa por baixo da barra. É box-shadow (não
 * borda) para a altura não mudar; em modo de alto contraste, onde a sombra some, entra uma borda.
 */
export function SiteHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 0)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={cn(
        'sticky top-0 z-50 bg-white forced-colors:border-b motion-safe:transition-shadow',
        scrolled && 'shadow-[0_1px_0_rgb(226_232_240),0_4px_14px_rgb(15_23_42/0.06)]',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FileText size={16} aria-hidden />
          </span>
          <span className="font-semibold tracking-tight text-slate-900">Orçafácil</span>
        </Link>
        {children}
      </div>
    </header>
  )
}
