import { describe, expect, it } from 'vitest'
import { resolveBranding } from './branding'

// PNG 1x1
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('resolveBranding', () => {
  it('sem dados, visual padrão', () => {
    expect(resolveBranding(undefined)).toEqual({ logo: null, accent: null })
    expect(resolveBranding({ logo: null, accent: null })).toEqual({ logo: null, accent: null })
  })

  it('aceita logotipo PNG/JPEG em data URL e cor #rrggbb', () => {
    expect(resolveBranding({ logo: PNG, accent: '#1d4ed8' })).toEqual({ logo: PNG, accent: '#1d4ed8' })
  })

  it('recusa URL externa, SVG e cor inválida (dados podem vir de sincronização ou arquivo)', () => {
    expect(resolveBranding({ logo: 'https://exemplo.com/x.png', accent: 'red' })).toEqual({ logo: null, accent: null })
    expect(resolveBranding({ logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', accent: null }).logo).toBeNull()
    expect(resolveBranding({ logo: 'file:///etc/passwd', accent: '#12' }).logo).toBeNull()
  })

  it('escurece cor clara para manter o texto legível', () => {
    const { accent } = resolveBranding({ logo: null, accent: '#ffeb3b' })
    expect(accent).not.toBe('#ffeb3b')
  })
})
