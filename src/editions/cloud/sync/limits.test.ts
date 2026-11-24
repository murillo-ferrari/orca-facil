import { describe, expect, it } from 'vitest'
import { limitNotice, type PlanUse } from './limits'

const free: PlanUse = {
  plano: 'free',
  orcamentos_no_mes: 15,
  limite_orcamentos_no_mes: 15,
  empresas: 1,
  limite_empresas: 1,
}

describe('limitNotice', () => {
  it('sem recusa por limite, não há aviso', () => {
    expect(limitNotice([], free)).toBeNull()
  })

  it('orçamentos: explica o limite, o uso e o que acontece', () => {
    const n = limitNotice(['quotes'], free)!
    expect(n.short).toBe('Limite de orçamentos do mês')
    expect(n.lines[0]).toContain('15 orçamentos novos por mês')
    expect(n.lines[0]).toContain('plano grátis')
    expect(n.lines.at(-1)).toContain('nada foi perdido')
  })

  it('empresas: usa o singular e o número do plano', () => {
    const n = limitNotice(['company_profiles'], free)!
    expect(n.short).toBe('Limite de empresas')
    expect(n.lines[0]).toContain('permite 1 empresa.')
  })

  it('os dois limites juntos', () => {
    const n = limitNotice(['quotes', 'company_profiles'], free)!
    expect(n.short).toBe('Limite do plano atingido')
    expect(n.lines).toHaveLength(3)
  })

  it('sem o uso do plano (rede ou plano sem limite), o aviso vale sem os números', () => {
    expect(limitNotice(['quotes'], null)!.lines[0]).toContain('limite de orçamentos novos por mês do seu plano')
    expect(limitNotice(['company_profiles'], null)!.lines[0]).toContain('limite de empresas do seu plano')
  })
})
