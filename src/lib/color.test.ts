import { describe, expect, it } from 'vitest'
import { PALETTE, contrastWithWhite, isHex, readableAccent } from './color'

describe('cor de destaque', () => {
  it('aceita só #rrggbb', () => {
    expect(isHex('#1d4ed8')).toBe(true)
    expect(isHex('#FFF')).toBe(false)
    expect(isHex('red')).toBe(false)
    expect(isHex(null)).toBe(false)
  })

  it('cor escura passa intacta', () => {
    expect(readableAccent('#1d4ed8')).toBe('#1d4ed8')
  })

  it('cor clara é escurecida até ter contraste 4.5:1 com o branco', () => {
    for (const c of ['#ffeb3b', '#7dd3fc', '#ffffff', '#a3e635']) {
      const out = readableAccent(c)
      expect(isHex(out)).toBe(true)
      expect(contrastWithWhite(out)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('branco puro vira cinza escuro, nunca fica invisível', () => {
    expect(readableAccent('#ffffff')).not.toBe('#ffffff')
  })
  it('as cores prontas já são legíveis e não mudam', () => {
    for (const { hex } of PALETTE) expect(readableAccent(hex)).toBe(hex)
  })
})
