/**
 * Captura por diferença: compara o estado atual com a última versão sincronizada, registro a registro,
 * e devolve o que precisa ir para a fila. Pura (sem IndexedDB nem rede), para ser testada isoladamente.
 */

/** Registro sincronizável, como o store o guarda (a `rev` do servidor fica à parte, em `Known`). */
export interface Synced {
  id: string
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

/**
 * Serialização estável: mesma estrutura, mesma string, independentemente da ordem das chaves.
 * `ignore`: campos de topo que o servidor controla e que não contam como alteração (ver IGNORE em engine.ts).
 */
export function fingerprint(value: unknown, ignore: readonly string[] = []): string {
  const v =
    ignore.length && value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([k]) => !ignore.includes(k)))
      : value
  return JSON.stringify(v, (_key, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  )
}

/**
 * Compara `current` com `known` (id → versão conhecida) e devolve as alterações.
 * - registro novo (não está em `known`): entra com `baseRev` 0 (o servidor ainda não tem);
 * - registro alterado: entra com o `rev` conhecido como base;
 * - registro que sumiu da lista: entra como exclusão.
 * Registros sem diferença não geram nada, então reabrir o app não gera tráfego.
 */
export function diffAgainstKnown(
  current: Synced[],
  known: Map<string, Known>,
  ignore: readonly string[] = [],
): Change[] {
  const changes: Change[] = []
  const seen = new Set<string>()

  for (const item of current) {
    seen.add(item.id)
    const prev = known.get(item.id)
    const print = fingerprint(item, ignore)
    if (prev && prev.data === print) continue
    changes.push({ id: item.id, baseRev: prev?.rev ?? 0, deleted: false, data: item })
  }

  for (const [id, prev] of known) {
    if (!seen.has(id)) changes.push({ id, baseRev: prev.rev, deleted: true, data: null })
  }

  return changes
}
