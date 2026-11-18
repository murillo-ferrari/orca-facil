import { describe, expect, it } from 'vitest'
import {
  formatAddressLines,
  formatCurrency,
  formatDate,
  formatDateLong,
  formatNumber,
  isValidCNPJ,
  isValidCPF,
  isValidDoc,
  maskCEP,
  maskCNPJ,
  maskCPF,
  maskDoc,
  maskPhone,
  onlyDigits,
  parseDate,
  slugify,
} from './format'

// Intl usa espaço não separável entre "R$" e o número
const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('moeda e números', () => {
  it('formata em reais', () => {
    expect(nbsp(formatCurrency(1234.5))).toBe('R$ 1.234,50')
    expect(nbsp(formatCurrency(0))).toBe('R$ 0,00')
  })
  it('trata valores não finitos como zero', () => {
    expect(nbsp(formatCurrency(Number.NaN))).toBe('R$ 0,00')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('0')
  })
  it('formata quantidades com até 3 casas', () => {
    expect(formatNumber(42.5)).toBe('42,5')
    expect(formatNumber(1.23456)).toBe('1,235')
    expect(formatNumber(1250)).toBe('1.250')
  })
})

describe('máscaras', () => {
  it('extrai só dígitos', () => expect(onlyDigits('(11) 9-8a')).toBe('1198'))
  it('CPF, incluindo digitação parcial e excesso de dígitos', () => {
    expect(maskCPF('52998224725')).toBe('529.982.247-25')
    expect(maskCPF('5299')).toBe('529.9')
    expect(maskCPF('529982247251234')).toBe('529.982.247-25')
  })
  it('CNPJ', () => expect(maskCNPJ('11222333000181')).toBe('11.222.333/0001-81'))
  it('maskDoc escolhe pelo tipo', () => {
    expect(maskDoc('52998224725', 'CPF')).toBe('529.982.247-25')
    expect(maskDoc('11222333000181', 'CNPJ')).toBe('11.222.333/0001-81')
  })
  it('CEP', () => expect(maskCEP('01310100')).toBe('01310-100'))
  it('telefone fixo (10 dígitos) e celular (11 dígitos)', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444')
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
  })
})

describe('validação de documentos', () => {
  it('CPF', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true)
    expect(isValidCPF('529.982.247-24')).toBe(false)
    expect(isValidCPF('111.111.111-11')).toBe(false) // dígitos repetidos
    expect(isValidCPF('5299822')).toBe(false)
  })
  it('CNPJ', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false)
    expect(isValidCNPJ('00.000.000/0000-00')).toBe(false)
  })
  it('isValidDoc escolhe pelo tipo', () => {
    expect(isValidDoc('52998224725', 'CPF')).toBe(true)
    expect(isValidDoc('52998224725', 'CNPJ')).toBe(false)
  })
})

describe('datas', () => {
  it('parseDate aceita yyyy-MM-dd e rejeita vazio/inválido', () => {
    expect(parseDate('2026-11-18')?.getDate()).toBe(18)
    expect(parseDate('')).toBeUndefined()
    expect(parseDate('2026-13-45')).toBeUndefined()
  })
  it('formatDate e formatDateLong em pt-BR', () => {
    expect(formatDate('2026-11-18')).toBe('18/11/2026')
    expect(formatDate('')).toBe('')
    expect(formatDateLong('2026-12-31')).toBe('31 de dezembro de 2026')
  })
})

describe('endereço e nomes de arquivo', () => {
  it('monta as duas linhas do endereço', () => {
    expect(
      formatAddressLines({
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Sala 12',
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      }),
    ).toEqual(['Avenida Paulista, 1000 - Sala 12', 'Bela Vista - São Paulo/SP - CEP 01310-100'])
  })
  it('omite linhas vazias', () => {
    expect(
      formatAddressLines({ cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' }),
    ).toEqual([])
  })
  it('slugify remove acentos e símbolos', () => {
    expect(slugify('Orçamento: Maria Oliveira!')).toBe('Orcamento-Maria-Oliveira')
    expect(slugify('ORC-0001')).toBe('ORC-0001')
  })
})
