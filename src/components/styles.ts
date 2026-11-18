/** Junta classes CSS, ignorando valores vazios/falsos (ex.: `cn('a', ativo && 'b')`). */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/** Aparência padrão dos campos de formulário (input, select, textarea). */
export const inputClass =
  'block w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-slate-50'
