import { diffAgainstKnown, fingerprint, type Change, type Known, type Synced } from './diff'

/**
 * Motor de sincronização: envia o que mudou (`aplicar_alteracoes`) e traz o que mudou no servidor
 * (`buscar_alteracoes`). Não conhece React, store nem IndexedDB: recebe o armazenamento (`SyncDb`), o cliente
 * de RPC e uma função que entrega ao store as mudanças vindas do servidor. Por isso roda e é testado sem rede.
 *
 * Uso: `capture(tabela, registros atuais)` para cada tabela logo antes de `sync()`.
 * A fila de envio não é guardada: é recalculada em cada `capture` (estado atual × última versão conhecida), então
 * não há entrada velha para limpar (registro criado e apagado offline, edição desfeita, etc.).
 *
 * Ordem que evita perda de dados: `onRemote` (store) roda ANTES de gravar a versão conhecida. Se o app fechar no
 * meio, o pior caso é um conflito falso na próxima vez; o inverso sobrescreveria o servidor com dado antigo.
 */

export const TABLES = ['user_settings', 'company_profiles', 'clients', 'catalog_items', 'quotes'] as const
export type Table = (typeof TABLES)[number]

/** Armazenamento chave-valor (IndexedDB no app, Map nos testes). */
export interface SyncDb {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  close?(): void
}

export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export interface ServerRow {
  id: string
  rev: number
  updated_at: string
  deleted_at: string | null
  data: unknown
}

export interface RemoteChanges {
  upserts: { id: string; data: unknown }[]
  deletedIds: string[]
}

/**
 * Conflito aguardando decisão: o mesmo registro mudou aqui e em outro dispositivo. A versão da nuvem já está no app
 * (o servidor prevalece até a pessoa decidir); estes dados alimentam a tela "Conflitos de sincronização".
 */
export interface ConflictRecord {
  table: Table
  id: string
  at: string
  /** Sua versão. `null` se você excluiu o registro. */
  local: unknown
  /** Versão da nuvem. `null` se foi excluída lá. `undefined` em registros gravados por versões antigas do app. */
  server?: unknown
  /** Última versão que este dispositivo conhecia (base da mescla). `null` se o registro era novo aqui. */
  base?: unknown
  serverRev: number
}

export const conflictKey = (c: ConflictRecord) => `${c.table}:${c.id}:${c.at}`

export interface SyncResult {
  applied: number
  conflicts: number
  rejected: { table: Table; id: string; reason: string }[]
  pulled: number
}

interface PushResponse {
  applied: { table: Table; id: string; rev: number }[]
  conflicts: { table: Table; id: string; server: ServerRow | null }[]
  rejected: { table: Table; id: string; reason: string }[]
}
type PullResponse = { server_time: string } & Record<Table, { rows: ServerRow[]; has_more: boolean }>

const BATCH = 50
/** Cobre transações confirmadas fora de ordem; ler a mesma linha duas vezes é inofensivo (comparamos `rev`). */
const OVERLAP_MS = 10_000
const MAX_PAGES = 100
/** Conflitos sem decisão são esquecidos depois deste prazo. */
const CONFLICT_TTL_MS = 30 * 24 * 3600 * 1000

/**
 * Campos que o servidor controla e que não contam como alteração. `nextNumber` da empresa: o servidor ignora o valor
 * enviado em updates e sempre devolve o dele; comparar levaria dois dispositivos a se reenviarem o perfil sem parar.
 */
const IGNORE: Partial<Record<Table, string[]>> = { company_profiles: ['nextNumber'] }

const changePrint = (table: Table, c: Change) => (c.deleted ? '\0excluído' : fingerprint(c.data, IGNORE[table]))

export class SyncEngine {
  readonly conflicts: ConflictRecord[] = []
  private known = Object.fromEntries(TABLES.map((t) => [t, new Map<string, Known>()])) as Record<
    Table,
    Map<string, Known>
  >
  private pending = Object.fromEntries(TABLES.map((t) => [t, [] as Change[]])) as Record<Table, Change[]>
  private cursors: Partial<Record<Table, string>> = {}
  /** Recusados pelo servidor (ex.: limite do plano), com o conteúdo recusado. Só em memória: reabrir tenta de novo. */
  private rejected = new Map<string, { print: string; reason: string }>()
  private dirty = new Set<Table | 'cursors' | 'conflicts'>()
  private chain: Promise<unknown> = Promise.resolve()
  private pageSize: number
  private db: SyncDb
  private client: RpcClient
  private onRemote: (table: Table, changes: RemoteChanges) => void

  constructor(
    db: SyncDb,
    client: RpcClient,
    onRemote: (table: Table, changes: RemoteChanges) => void,
    { pageSize = 500 } = {},
  ) {
    this.db = db
    this.client = client
    this.onRemote = onRemote
    this.pageSize = pageSize
  }

  async load() {
    for (const t of TABLES) {
      this.known[t] = new Map(((await this.db.get(`known:${t}`)) as [string, Known][] | undefined) ?? [])
    }
    this.cursors = ((await this.db.get('cursors')) as typeof this.cursors | undefined) ?? {}
    const stored = ((await this.db.get('conflicts')) as ConflictRecord[] | undefined) ?? []
    const cutoff = Date.now() - CONFLICT_TTL_MS
    this.conflicts.push(...stored.filter((c) => Date.parse(c.at) >= cutoff))
    if (this.conflicts.length !== stored.length) this.dirty.add('conflicts') // gravado junto da próxima gravação
  }

  /**
   * Tira um conflito da lista (resolvido ou descartado). `revive`: a pessoa quer manter a própria versão de um item
   * que foi excluído na nuvem; o motor passa a tratar a exclusão como a versão conhecida, e o próximo envio recria
   * o item sobre ela (o servidor aceita desfazer a exclusão quando a versão-base confere).
   */
  dismissConflict(key: string, { revive = false } = {}) {
    return this.lock(async () => {
      const i = this.conflicts.findIndex((c) => conflictKey(c) === key)
      if (i < 0) return
      const [c] = this.conflicts.splice(i, 1)
      this.dirty.add('conflicts')
      if (revive) {
        this.known[c.table].set(c.id, { rev: c.serverRev, data: '' })
        this.dirty.add(c.table)
      }
      await this.persist()
    })
  }

  /** Nunca sincronizou neste dispositivo (nenhum cursor gravado). */
  get fresh() {
    return TABLES.every((t) => !this.cursors[t])
  }

  /** Alterações que o servidor recusou e que seguem paradas até o registro ser editado (ou o app reaberto). */
  get rejectedCount() {
    return this.rejected.size
  }

  /** As mesmas alterações, com o motivo da recusa (ex.: `limite_do_plano`). */
  get rejectedItems() {
    return [...this.rejected].map(([key, r]) => {
      const i = key.indexOf(':')
      return { table: key.slice(0, i) as Table, id: key.slice(i + 1), reason: r.reason }
    })
  }

  /** O servidor já conhece este registro (foi enviado ou recebido). */
  isSynced(table: Table, id: string) {
    return this.known[table].has(id)
  }

  /** Alterações aguardando envio (para o indicador "N alterações pendentes"). */
  get pendingCount() {
    return TABLES.reduce((n, t) => n + this.pending[t].length, 0)
  }

  /** Recalcula a fila de uma tabela a partir do estado atual do store. */
  capture(table: Table, current: Synced[]) {
    return this.lock(async () => {
      // Recusa de um registro que não existe mais aqui (excluído antes de ser aceito) não vale mais
      const ids = new Set(current.map((x) => x.id))
      for (const key of [...this.rejected.keys()]) {
        if (key.startsWith(`${table}:`) && !ids.has(key.slice(table.length + 1))) this.rejected.delete(key)
      }
      this.pending[table] = diffAgainstKnown(current, this.known[table], IGNORE[table]).filter(
        (c) => !this.isRejected(table, c),
      )
    })
  }

  /** Envia a fila e depois busca as novidades. Chamadas simultâneas esperam a anterior terminar. */
  sync(): Promise<SyncResult> {
    return this.lock(async () => {
      const pushed = await this.push()
      return { ...pushed, pulled: await this.pull() }
    })
  }

  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn)
    this.chain = run.catch(() => undefined)
    return run
  }

  private isRejected(table: Table, c: Change) {
    const key = `${table}:${c.id}`
    const rejected = this.rejected.get(key)
    if (rejected === undefined) return false
    if (rejected.print === changePrint(table, c)) return true
    this.rejected.delete(key) // o usuário mudou o registro: vale tentar de novo
    return false
  }

  private isDirty(table: Table, id: string) {
    return this.pending[table].some((c) => c.id === id) || this.rejected.has(`${table}:${id}`)
  }

  private takePending(table: Table, id: string) {
    const i = this.pending[table].findIndex((c) => c.id === id)
    return i < 0 ? undefined : this.pending[table].splice(i, 1)[0]
  }

  private async persist() {
    for (const k of this.dirty) {
      if (k === 'cursors') await this.db.set('cursors', this.cursors)
      else if (k === 'conflicts') await this.db.set('conflicts', this.conflicts)
      else await this.db.set(`known:${k}`, [...this.known[k]])
    }
    this.dirty.clear()
  }

  /**
   * Aplica linhas do servidor ao store e à versão conhecida. Pula o que já temos (mesma `rev`: eco do que
   * enviamos ou janela de sobreposição) e o que tem edição local pendente (o envio resolve como conflito).
   * `force`: usado no conflito, em que a versão do servidor sempre vale.
   */
  private applyRows(table: Table, rows: ServerRow[], force = false) {
    const known = this.known[table]
    const out: RemoteChanges = { upserts: [], deletedIds: [] }
    for (const row of rows) {
      const prev = known.get(row.id)
      if (!force && (this.isDirty(table, row.id) || (prev && row.rev <= prev.rev))) continue
      if (row.deleted_at) {
        if (prev || force) {
          known.delete(row.id)
          out.deletedIds.push(row.id)
        }
      } else {
        known.set(row.id, { rev: row.rev, data: fingerprint(row.data, IGNORE[table]) })
        out.upserts.push({ id: row.id, data: row.data })
      }
    }
    const n = out.upserts.length + out.deletedIds.length
    if (n) {
      this.dirty.add(table)
      this.onRemote(table, out)
    }
    return n
  }

  private async push() {
    const result = { applied: 0, conflicts: 0, rejected: [] as SyncResult['rejected'] }
    for (;;) {
      const batch = TABLES.flatMap((table) => this.pending[table].map((change) => ({ table, change }))).slice(0, BATCH)
      if (!batch.length) return result

      const { data, error } = await this.client.rpc('aplicar_alteracoes', {
        // O servidor identifica "registro novo" por base_rev nulo; nosso 0 significa o mesmo
        p_changes: batch.map(({ table, change: c }) => ({
          table,
          id: c.id,
          base_rev: c.baseRev || null,
          deleted: c.deleted,
          // Na exclusão a chave `data` não pode ir (nem como null): o RPC leria JSON null e violaria a constraint
          ...(c.deleted ? {} : { data: c.data }),
        })),
      })
      if (error) throw new Error(error.message)
      const res = data as PushResponse

      for (const a of res.applied) {
        const c = this.takePending(a.table, a.id)
        if (!c) continue
        if (c.deleted) this.known[a.table].delete(a.id)
        else this.known[a.table].set(a.id, { rev: a.rev, data: fingerprint(c.data, IGNORE[a.table]) })
        this.dirty.add(a.table)
        result.applied++
      }
      for (const x of res.conflicts) {
        const c = this.takePending(x.table, x.id)
        if (x.server) {
          const known = this.known[x.table].get(x.id)
          this.conflicts.push({
            table: x.table,
            id: x.id,
            at: new Date().toISOString(),
            local: c?.deleted ? null : c?.data,
            server: x.server.deleted_at ? null : x.server.data,
            base: known ? (JSON.parse(known.data) as unknown) : null,
            serverRev: x.server.rev,
          })
          this.dirty.add('conflicts')
          this.applyRows(x.table, [x.server], true)
        } else {
          // O servidor já não tem o registro (apagado em definitivo): esquece a versão conhecida e recria na próxima
          this.known[x.table].delete(x.id)
          this.dirty.add(x.table)
        }
        result.conflicts++
      }
      for (const r of res.rejected) {
        const c = this.takePending(r.table, r.id)
        if (c) this.rejected.set(`${r.table}:${r.id}`, { print: changePrint(r.table, c), reason: r.reason })
        result.rejected.push({ table: r.table, id: r.id, reason: r.reason })
      }

      await this.persist()
      // Garante avanço: toda entrada enviada tem de sair da fila (aplicada, conflito ou recusada)
      if (batch.some(({ table, change }) => this.pending[table].some((c) => c.id === change.id))) {
        throw new Error('O servidor não respondeu sobre todas as alterações enviadas')
      }
    }
  }

  /** Menor cursor entre as tabelas; sem cursor em alguma, busca tudo. */
  private pullFrom(withOverlap: boolean) {
    const stamps = TABLES.map((t) => this.cursors[t])
    if (stamps.some((s) => !s)) return '-infinity'
    const min = Math.min(...stamps.map((s) => Date.parse(s!)))
    return new Date(min - (withOverlap ? OVERLAP_MS : 0)).toISOString()
  }

  private async pull() {
    let total = 0
    for (let page = 0; page < MAX_PAGES; page++) {
      // A sobreposição só na primeira página: nas seguintes ela faria repetir a mesma página para sempre
      const { data, error } = await this.client.rpc('buscar_alteracoes', {
        p_desde: this.pullFrom(page === 0),
        p_limite: this.pageSize,
      })
      if (error) throw new Error(error.message)
      const res = data as PullResponse

      let more = false
      for (const t of TABLES) {
        const part = res[t]
        total += this.applyRows(t, part.rows)
        // Com mais páginas, o cursor é a última linha vista; sem, tudo até agora foi recebido
        this.cursors[t] = part.has_more ? part.rows[part.rows.length - 1].updated_at : res.server_time
        more ||= part.has_more
      }
      this.dirty.add('cursors')
      await this.persist()
      if (!more) return total
    }
    throw new Error(`Mais de ${MAX_PAGES} páginas de novidades; tente de novo`)
  }
}
