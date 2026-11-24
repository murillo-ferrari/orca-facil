/**
 * Texto do aviso quando o servidor recusa alterações por limite do plano. Puro, testado sem navegador.
 * O uso vem de `uso_do_plano` (orçamentos criados no mês e empresas); o plano grátis é o único com limite hoje.
 */

export interface PlanUse {
  plano: string
  orcamentos_no_mes: number
  limite_orcamentos_no_mes: number | null
  empresas: number
  limite_empresas: number | null
}

export interface LimitNotice {
  /** Frase curta para o indicador */
  short: string
  /** Explicação completa, para a tela de Ajustes */
  lines: string[]
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * `tables`: o que foi recusado por limite. `rejected`: quantas alterações estão paradas (todas as razões).
 * Sem o uso do plano (rede), o aviso vale sem os números.
 */
export function limitNotice(tables: ('quotes' | 'company_profiles')[], use: PlanUse | null): LimitNotice | null {
  if (!tables.length) return null
  const lines: string[] = []
  const quotes = tables.includes('quotes')
  const profiles = tables.includes('company_profiles')

  if (quotes) {
    const limit = use?.limite_orcamentos_no_mes
    lines.push(
      limit
        ? `Você chegou ao limite de ${plural(limit, 'orçamento novo', 'orçamentos novos')} por mês do plano grátis (${use?.orcamentos_no_mes ?? limit} neste mês). Os orçamentos acima do limite ficam só neste dispositivo e voltam a sincronizar no próximo mês, ou assim que você mudar de plano.`
        : 'Você chegou ao limite de orçamentos novos por mês do seu plano. Os orçamentos acima do limite ficam só neste dispositivo até o próximo mês ou até você mudar de plano.',
    )
  }
  if (profiles) {
    const limit = use?.limite_empresas
    lines.push(
      limit
        ? `O plano grátis permite ${plural(limit, 'empresa', 'empresas')}. A empresa a mais fica só neste dispositivo; exclua uma empresa ou mude de plano para sincronizá-la.`
        : 'Você chegou ao limite de empresas do seu plano. A empresa a mais fica só neste dispositivo.',
    )
  }
  lines.push('Seus dados continuam salvos aqui e nada foi perdido. Edite o item recusado para tentar enviar de novo.')
  return {
    short:
      quotes && profiles ? 'Limite do plano atingido' : quotes ? 'Limite de orçamentos do mês' : 'Limite de empresas',
    lines,
  }
}
