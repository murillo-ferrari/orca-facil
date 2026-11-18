import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv (formato do Excel em português)', () => {
  it('usa ponto e vírgula, vírgula decimal e CRLF', () => {
    expect(toCsv(['Cliente', 'Valor'], [['Maria', 1234.5]])).toBe('Cliente;Valor\r\nMaria;1234,5')
  })
  it('protege textos com separador, aspas ou quebra de linha', () => {
    expect(toCsv(['a'], [['x;y'], ['diz "oi"'], ['linha\nnova']])).toBe('a\r\n"x;y"\r\n"diz ""oi"""\r\n"linha\nnova"')
  })
  it('deixa vazio o que é nulo ou não finito', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, Number.NaN]])).toBe('a;b;c\r\n;;')
  })
})
