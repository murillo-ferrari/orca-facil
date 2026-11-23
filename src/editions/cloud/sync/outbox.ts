import type { Change } from './diff'

/**
 * Fila de envio: uma entrada por registro. Se o mesmo registro muda várias vezes antes de sincronizar,
 * a entrada guarda o último estado e a `baseRev` original (a do servidor quando a edição começou).
 * Assim o próprio dispositivo nunca entra em conflito consigo mesmo.
 */
export class Outbox {
  private items = new Map<string, Change>()

  /** Acrescenta mudanças; a `baseRev` da entrada existente é preservada. */
  add(changes: Change[]) {
    for (const change of changes) {
      const prev = this.items.get(change.id)
      this.items.set(change.id, prev ? { ...change, baseRev: prev.baseRev } : change)
    }
  }

  /** Próximo lote, na ordem em que os registros entraram na fila. */
  take(limit = 50): Change[] {
    return [...this.items.values()].slice(0, limit)
  }

  /** Remove entradas aceitas pelo servidor (ou descartadas, ex.: limite do plano). */
  ack(ids: string[]) {
    for (const id of ids) this.items.delete(id)
  }

  get size() {
    return this.items.size
  }
}
