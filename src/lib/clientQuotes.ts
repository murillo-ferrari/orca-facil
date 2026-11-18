import type { Client, Quote } from '../types'
import { onlyDigits } from './format'

/**
 * Um orçamento pertence ao cliente quando está vinculado ao cadastro dele.
 * Orçamentos sem vínculo (cliente digitado à mão) também contam se o CPF/CNPJ for o mesmo.
 */
export function quoteBelongsToClient(q: Quote, c: Client): boolean {
  if (q.client.clientId) return q.client.clientId === c.id
  const doc = onlyDigits(c.document)
  return doc.length > 0 && onlyDigits(q.client.document) === doc
}
