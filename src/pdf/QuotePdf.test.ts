import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { QuotePdf } from './QuotePdf'
import { pdfFileName } from './exportPdf'
import { newItem, newProfile, newQuote } from '../store/factories'
import type { Quote } from '../types'

const profile = { ...newProfile(), tradeName: 'Silva Reformas', document: '11.222.333/0001-81' }

function makeQuote(itemCount: number): Quote {
  return {
    ...newQuote(profile, 'ORC-0001'),
    client: { ...newQuote(profile, 'x').client, name: 'Maria Oliveira' },
    items: Array.from({ length: itemCount }, (_, i) =>
      newItem({ description: `Serviço ${i + 1}`, details: i % 3 ? '' : 'Detalhe do serviço', unitPrice: 100 }),
    ),
  }
}

async function pageCount(quote: Quote) {
  const buf = await renderToBuffer(createElement(QuotePdf, { quote, profile }) as never)
  const text = buf.toString('latin1')
  expect(text.startsWith('%PDF')).toBe(true)
  // Objetos de página ("/Type /Page", sem o "s" de "/Pages")
  return (text.match(/\/Type \/Page(?!s)/g) ?? []).length
}

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('PDF do orçamento', () => {
  it('com logotipo e cor continua em 1 página', async () => {
    const branded = { ...profile, branding: { logo: PNG, accent: '#1d4ed8' } }
    const buf = await renderToBuffer(createElement(QuotePdf, { quote: makeQuote(3), profile: branded }) as never)
    expect(buf.toString('latin1')).toContain('/Subtype /Image')
    expect((buf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length).toBe(1)
  })

  it('logotipo inválido é ignorado, sem quebrar o PDF', async () => {
    const bad = { ...profile, branding: { logo: 'https://exemplo.com/x.png', accent: null } }
    const buf = await renderToBuffer(createElement(QuotePdf, { quote: makeQuote(3), profile: bad }) as never)
    expect(buf.toString('latin1')).not.toContain('/Subtype /Image')
  })

  it('orçamento curto cabe em 1 página', async () => {
    expect(await pageCount(makeQuote(3))).toBe(1)
  })

  it('orçamento longo quebra em várias páginas', async () => {
    expect(await pageCount(makeQuote(40))).toBeGreaterThanOrEqual(3)
  })

  it('nome do arquivo sem acentos nem espaços', () => {
    expect(pdfFileName(makeQuote(1))).toBe('Orcamento-ORC-0001-Maria-Oliveira.pdf')
  })
})
