import { create } from 'zustand'
import { SCHEMA_VERSION, migrateState, pickData } from '../../../data/schema'
import { DEFAULT_UNITS } from '../../../store/factories'
import { useStore } from '../../../store/store'
import { toast } from '../../../components/toast'
import { supabase } from '../supabase'
import { SyncEngine, TABLES, conflictKey, type ConflictRecord, type RpcClient, type SyncDb } from './engine'
import { openSyncDb } from './idb'
import { applyRemote, findRecord, renumberQuotes, toTables } from './mapping'
import { autoResolvable, planResolution, type Choice, type Rec } from './conflicts'

/**
 * Liga o store ao motor de sincronização para o usuário logado. Um controlador por vez (singleton), porque o
 * store também é único. Cópia local: o estado inteiro do store vai para o IndexedDB (chave `snapshot`) a cada
 * alteração e antes de cada gravação do motor, então o snapshot nunca fica atrás da "versão conhecida".
 * Sem isso, o app reaberto veria registros que o servidor tem e a cópia local não e os trataria como apagados.
 * ponytail: snapshot do estado inteiro a cada gravação; troque por gravação por registro se passar de alguns MB.
 */

export interface SyncUiState {
  phase: 'loading' | 'idle' | 'syncing' | 'offline' | 'error'
  /** alterações ainda não enviadas */
  pending: number
  /** alterações que o servidor recusou (ex.: limite do plano) */
  rejected: number
  /** conflitos aguardando decisão da pessoa (tela de conflitos) */
  conflicts: ConflictRecord[]
}
export const useSyncState = create<SyncUiState>(() => ({ phase: 'loading', pending: 0, rejected: 0, conflicts: [] }))
const ui = (patch: Partial<SyncUiState>) => useSyncState.setState(patch)

const SYNC_DELAY_MS = 1000
const POLL_MS = 60_000
const MAX_ROUNDS = 5

const emptyData = () => ({
  profiles: [],
  activeProfileId: null,
  clients: [],
  units: DEFAULT_UNITS,
  catalog: [],
  quotes: [],
})

// supabase.rpc é tipado por função; o motor só precisa do formato genérico
const rpcClient: RpcClient = {
  rpc: (fn, args) => supabase.rpc(fn as never, args as never) as unknown as ReturnType<RpcClient['rpc']>,
}

interface Running {
  syncNow: () => Promise<void>
  resolve: (c: ConflictRecord, choices: Record<string, Choice>) => Promise<void>
  dismiss: (c: ConflictRecord) => Promise<void>
  stop: () => Promise<void>
}
let current: Running | null = null
/** Início e fim entram numa fila: o React (StrictMode) pode chamar start/stop/start em sequência rápida. */
let queue: Promise<unknown> = Promise.resolve()

export const startSync = (userId: string) => void (queue = queue.then(() => open(userId)).catch(onOpenError))
export function closeSync() {
  queue = queue.then(() => current?.stop()).catch(() => undefined)
  return queue
}
export const stopSync = () => void closeSync()
export const syncNow = () => current?.syncNow()
/** Aplica a decisão da pessoa sobre um conflito (`choices`: campo → lado; `_item` para item inteiro) e envia. */
export const resolveConflict = (c: ConflictRecord, choices: Record<string, Choice>) => current?.resolve(c, choices)
/** Mantém a versão da nuvem (já no app) e tira o conflito da lista. */
export const dismissConflict = (c: ConflictRecord) => current?.dismiss(c)

function onOpenError(e: unknown) {
  console.error('sync: falha ao abrir a cópia local', e)
  ui({ phase: 'error' })
}

async function open(userId: string) {
  const db = await openSyncDb(userId)
  const saveSnapshot = () => db.set('snapshot', pickData(useStore.getState()))
  const guarded: SyncDb = {
    get: (k) => db.get(k),
    set: async (k, v) => {
      await saveSnapshot()
      await db.set(k, v)
    },
  }

  const snapshot = await db.get('snapshot')
  if (snapshot) {
    useStore.setState(migrateState(snapshot, SCHEMA_VERSION))
  } else {
    // Sem cópia dos dados, a "versão conhecida" não vale: com ela, tudo pareceria apagado e seria excluído no servidor
    for (const k of [...TABLES.map((t) => `known:${t}`), 'cursors', 'conflicts']) await db.set(k, undefined)
    useStore.setState(emptyData())
  }

  let suppress = false
  const engine = new SyncEngine(guarded, rpcClient, (table, changes) => {
    suppress = true // mudança que veio do servidor não precisa disparar novo envio
    try {
      useStore.setState((s) => applyRemote(s, table, changes))
    } finally {
      suppress = false
    }
  })
  await engine.load()

  let stopped = false
  let running = false
  let again = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const captureAll = async () => {
    const rows = toTables(useStore.getState(), userId)
    for (const t of TABLES) await engine.capture(t, rows[t])
  }

  /** Sincronização em andamento; `stop()` espera por ela antes de fechar o IndexedDB. */
  let inflight: Promise<void> = Promise.resolve()

  function run(): Promise<void> {
    if (stopped) return Promise.resolve()
    if (running) {
      again = true
      return inflight
    }
    // `runOnce` marca `running` antes do primeiro await, então a checagem acima já vale para a próxima chamada
    inflight = runOnce()
    return inflight
  }

  /** Conflitos que ainda precisam da pessoa; os de campos diferentes são mesclados sozinhos. */
  const publishConflicts = () => ui({ conflicts: [...engine.conflicts] })

  async function applyPlan(c: ConflictRecord, choices: Record<string, Choice>) {
    const plan = planResolution(c, findRecord(useStore.getState(), c.table, c.id) as Rec | null, choices)
    if (plan.apply) useStore.setState((s) => applyRemote(s, c.table, plan.apply!))
    await engine.dismissConflict(conflictKey(c), { revive: plan.revive })
  }

  async function autoResolve() {
    for (const c of [...engine.conflicts]) if (autoResolvable(c)) await applyPlan(c, {})
  }

  async function runOnce() {
    running = true
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        again = false
        if (!navigator.onLine) {
          await captureAll()
          ui({ phase: 'offline', pending: engine.pendingCount, rejected: engine.rejectedCount })
          return
        }
        ui({ phase: 'syncing' })
        // Dispositivo novo: traz o que o servidor já tem ANTES de enviar, senão as unidades padrão viram "conflito"
        if (engine.fresh) await engine.sync()
        await captureAll()
        const r = await engine.sync()

        const duplicates = r.rejected.filter((x) => x.table === 'quotes' && x.reason === 'duplicado').map((x) => x.id)
        const patch = duplicates.length ? renumberQuotes(useStore.getState(), duplicates) : null
        if (patch) {
          useStore.setState(patch)
          again = true
          toast('Número de orçamento já usado em outro dispositivo: o orçamento recebeu um novo número.', 'error')
        }
        if (r.conflicts) {
          const before = engine.conflicts.length
          await autoResolve()
          const asking = engine.conflicts.length
          const merged = before - asking
          if (merged) again = true // a mescla automática gerou mudança local a enviar
          if (asking) {
            toast(
              `${asking} ${asking === 1 ? 'item mudou' : 'itens mudaram'} em outro dispositivo e precisa da sua decisão. Veja em Ajustes › Conflitos de sincronização.`,
              'error',
            )
          }
        }
        if (!again) break
      }
      if (!stopped) {
        publishConflicts()
        ui({ phase: 'idle', pending: engine.pendingCount, rejected: engine.rejectedCount })
      }
    } catch (e) {
      console.error('sync', e)
      if (!stopped) ui({ phase: navigator.onLine ? 'error' : 'offline', pending: engine.pendingCount })
    } finally {
      running = false
      if (again && !stopped) timer = setTimeout(run, SYNC_DELAY_MS)
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(run, SYNC_DELAY_MS)
  }
  const unsubscribe = useStore.subscribe(() => {
    if (!suppress) schedule()
  })
  const onVisible = () => document.visibilityState === 'visible' && void run()
  const onOnline = () => void run()
  const poll = setInterval(onVisible, POLL_MS)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  current = {
    syncNow: run,
    resolve: async (c, choices) => {
      await inflight.catch(() => undefined)
      await applyPlan(c, choices)
      publishConflicts()
      void run()
    },
    dismiss: async (c) => {
      await inflight.catch(() => undefined)
      await engine.dismissConflict(conflictKey(c))
      publishConflicts()
    },
    stop: async () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(poll)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribe()
      // Fechar o banco com uma gravação do motor em andamento dá "database connection is closing" e perde o passo
      await inflight.catch(() => undefined)
      await saveSnapshot().catch(() => undefined)
      db.close?.()
      useStore.setState(emptyData()) // os dados de uma conta não podem ficar na memória para a próxima
      ui({ phase: 'loading', pending: 0, rejected: 0, conflicts: [] })
      current = null
    },
  }
  publishConflicts()
  ui({ phase: 'idle', pending: 0, rejected: 0 })
  void run()
}
