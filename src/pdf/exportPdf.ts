import { createElement } from 'react'
import type { CompanyProfile, Quote } from '../types'
import { slugify } from '../lib/format'
import { brandingAllowed } from '../editions/branding'

/** Gera o PDF sob demanda (a biblioteca só é carregada quando necessária). */
export async function renderQuotePdf(quote: Quote, profile: CompanyProfile): Promise<Blob> {
  const [{ pdf }, { QuotePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./QuotePdf')])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Sem Pro, o PDF sai com o visual padrão (os dados de aparência continuam salvos)
  const shown = brandingAllowed() ? profile : { ...profile, branding: undefined }
  return pdf(createElement(QuotePdf, { quote, profile: shown }) as any).toBlob()
}

export function pdfFileName(quote: Quote) {
  const client = slugify(quote.client.name)
  return `Orcamento-${slugify(quote.number)}${client ? `-${client}` : ''}.pdf`
}

export async function downloadQuotePdf(quote: Quote, profile: CompanyProfile) {
  const blob = await renderQuotePdf(quote, profile)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = pdfFileName(quote)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
