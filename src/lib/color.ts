const HEX = /^#[0-9a-f]{6}$/i

export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

const parse = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

function luminance(hex: string) {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste WCAG entre a cor e o branco (1 a 21). */
export const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05)

/**
 * Escurece a cor, se preciso, até ter contraste mínimo com o branco (4.5:1, WCAG 1.4.3). Serve para os dois usos no
 * PDF: texto branco sobre a cor e texto da cor sobre o papel branco.
 */
export function readableAccent(hex: string, min = 4.5): string {
  const base = parse(hex)
  let f = 1
  while (f > 0 && contrastWithWhite(toHex(base.map((c) => c * f))) < min) f -= 0.02
  return toHex(base.map((c) => c * Math.max(f, 0)))
}

/** Cores prontas do seletor. Todas já têm contraste ≥ 4.5:1 com o branco (testado), então não são ajustadas. */
export const PALETTE: { name: string; hex: string }[] = [
  { name: 'Azul', hex: '#1d4ed8' },
  { name: 'Turquesa', hex: '#0f766e' },
  { name: 'Verde', hex: '#15803d' },
  { name: 'Laranja', hex: '#c2410c' },
  { name: 'Vermelho', hex: '#b91c1c' },
  { name: 'Rosa', hex: '#be185d' },
  { name: 'Roxo', hex: '#7e22ce' },
  { name: 'Grafite', hex: '#334155' },
]
