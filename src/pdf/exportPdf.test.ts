import { afterEach, describe, expect, it } from 'vitest'
import { renderQuotePdf } from './exportPdf'
import { setBrandingAllowed } from '../editions/branding'
import { newItem, newProfile, newQuote } from '../store/factories'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const profile = { ...newProfile(), tradeName: 'Silva', branding: { logo: PNG, accent: '#1d4ed8' } }
const quote = { ...newQuote(profile, 'ORC-0001'), items: [newItem({ description: 'Serviço', unitPrice: 100 })] }
const hasImage = async () =>
  new TextDecoder('latin1')
    .decode(await (await renderQuotePdf(quote, profile)).arrayBuffer())
    .includes('/Subtype /Image')

afterEach(() => setBrandingAllowed(false))

describe('logotipo e cor no PDF (plano Pro)', () => {
  it('sem Pro (ou na edição Local), o PDF sai com o visual padrão', async () => {
    expect(await hasImage()).toBe(false)
  })

  it('com Pro, o logotipo entra no PDF', async () => {
    setBrandingAllowed(true)
    expect(await hasImage()).toBe(true)
  })
})
