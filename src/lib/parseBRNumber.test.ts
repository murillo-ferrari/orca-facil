import { describe, expect, it } from 'vitest'
import { parseBRNumber } from './format'

describe('parseBRNumber (o que o usuário digita nos campos de valor e quantidade)', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1234.56', 1234.56], // ponto como decimal, se for o único
    ['1.234.567', 1234567], // vários pontos = separador de milhar
    ['28,9', 28.9],
    ['R$ 30,00', 30],
    ['', 0],
    ['abc', 0],
  ])('"%s" → %d', (text, expected) => {
    expect(parseBRNumber(text)).toBe(expected)
  })
})
