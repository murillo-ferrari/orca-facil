/**
 * Reserva de números de orçamento por dispositivo (plano 7.6). Puro: recebe as funções que chamam o servidor
 * (`reservar_numeros_orcamento` e `definir_proximo_numero`), então é testado sem rede.
 *
 * Cada dispositivo reserva um bloco de números por empresa e os usa mesmo offline. Quando sobram menos de LOW
 * números, repõe. O servidor só avança o contador ao reservar, então dois dispositivos nunca recebem o mesmo bloco.
 * Saltos na numeração são esperados (números reservados e não usados).
 *
 * ponytail: se o bloco acabar offline, o app segue numerando localmente e o servidor recusa o número repetido na
 * sincronização (`renumberQuotes` renumera). Teto: um PDF já enviado com esse número ficaria diferente do orçamento.
 * Evolução (plano 7.6, item 4): número provisório "definido ao sincronizar" e PDF bloqueado até lá.
 * Também: entre `reservar` e `definir` outro dispositivo pode reservar; o índice único dos orçamentos barra o
 * número repetido e `renumberQuotes` resolve, então o pior caso é um orçamento renumerado.
 */

export const BLOCK = 5
/** Repõe o bloco quando sobram menos que isto (mantém uma folga para quando a conexão cair). */
export const LOW = 2

/** Empresa → fim (exclusivo) do bloco reservado por este dispositivo. */
export type Blocks = Record<string, number>

export interface NumberingRpc {
  /** Reserva `quantity` números e devolve o primeiro (o contador do servidor antes de avançar). */
  reserve(profileId: string, quantity: number): Promise<number>
  /** Define o contador do servidor (campo "Próximo número" da empresa). */
  setNext(profileId: string, next: number): Promise<void>
}

/**
 * Garante que a empresa tenha números reservados. Devolve o novo fim do bloco e o próximo número local, ou `null`
 * se já há folga. `end` indefinido = nunca reservou neste dispositivo. `usedMax` = maior número já usado nos orçamentos
 * da empresa (todos os dispositivos). No máximo 2 chamadas ao servidor.
 *
 * O próximo número local só sobe, nunca desce. Se o servidor está atrás do que este dispositivo já usou (números
 * criados offline além do bloco, ou "Próximo número" digitado à mão), o contador do servidor é levado adiante.
 */
export async function reserveBlock(
  rpc: NumberingRpc,
  profile: { id: string; nextNumber: number },
  end: number | undefined,
  usedMax = 0,
): Promise<{ end: number; nextNumber: number } | null> {
  if (end !== undefined && end - profile.nextNumber >= LOW) return null

  const first = await rpc.reserve(profile.id, BLOCK)
  // Bloco colado no anterior: ninguém reservou no meio, então a numeração segue sem pular
  const contiguous = end !== undefined && first === end
  let next = contiguous ? profile.nextNumber : Math.max(profile.nextNumber, first)
  // Números já usados que o servidor não conhece (dados anteriores à reserva ou importados): fica depois deles.
  // Em uso normal `usedMax` é sempre menor que `first`, porque todo número usado saiu de um bloco já reservado.
  if (usedMax >= first) next = Math.max(next, usedMax + 1)
  const blockEnd = first + BLOCK
  if (blockEnd - next >= LOW) return { end: blockEnd, nextNumber: next }

  // O servidor está muito atrás do uso local: leva o contador para além dele e fica com o bloco a partir daí
  await rpc.setNext(profile.id, next + BLOCK)
  return { end: next + BLOCK, nextNumber: next }
}
