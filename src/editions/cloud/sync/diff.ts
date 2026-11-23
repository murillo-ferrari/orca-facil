/**
 * Captura por diferença: compara o estado atual com a última versão sincronizada, registro a registro,
 * e devolve o que precisa ir para a fila. Pura (sem IndexedDB nem rede), para ser testada isoladamente.
 */

/** Registro sincronizável, como ele é guardado localmente. `rev` é a versão conhecida do servidor. */
export interface Synced {
  id: string
  rev: number
  [field: string]: unknown
}

/** Versão conhecida de cada registro: `rev` do servidor e o conteúdo enviado/recebido por último. */
export interface Known {
  rev: number
  data: string
}

export interface Change {
  id: string
  /** `rev` que o servidor tinha quando o dispositivo começou a editar; é a base para detectar conflito */
  baseRev: number
  deleted: boolean
  data: unknown
}

/** Serialização estável: mesma estrutura, mesma string, independentemente da ordem das chaves. */
export function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

/**
 * Compara `current` com `known` (id → versão conhecida) e devolve as alterações.
 * - registro novo (não está em `known`): entra com `baseRev` 0 (o servidor ainda não tem);
 * - registro alterado: entra com o `rev` conhecido como base;
 * - registro que sumiu da lista: entra como exclusão.
 * Registros sem diferença não geram nada, então reabrir o app não gera tráfego.
 */
export function diffAgainstKnown(current: Synced[], known: Map<string, Known>): Change[] {
  const changes: Change[] = []
  const seen = new Set<string>()

  for (const item of current) {
    seen.add(item.id)
    const prev = known.get(item.id)
    const print = fingerprint(item)
    if (prev && prev.data === print) continue
    changes.push({ id: item.id, baseRev: prev?.rev ?? 0, deleted: false, data: item })
  }

  for (const [id, prev] of known) {
    if (!seen.has(id)) changes.push({ id, baseRev: prev.rev, deleted: true, data: null })
  }

  return changes
}
