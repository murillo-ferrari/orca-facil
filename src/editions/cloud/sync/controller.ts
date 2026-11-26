import { create } from 'zustand'
import { SCHEMA_VERSION, migrateState, pickData, type DataState } from '../../../data/schema'
import { DEFAULT_UNITS } from '../../../store/factories'
import { useStore } from '../../../store/store'
import { toast } from '../../../components/toast'
import { supabase } from '../supabase'
import { SyncEngine, TABLES, conflictKey, type ConflictRecord, type RpcClient, type SyncDb } from './engine'
import { openSyncDb } from './idb'
import { applyRemote, findRecord, maxUsedNumber, renumberQuotes, toTables } from './mapping'
import { mergeLocalIntoCloud } from './migration'
import { reserveBlock, type Blocks, type NumberingRpc } from './numbering'
import type { PlanUse } from './limits'
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
  /** recusas por limite do plano (quais tabelas) e o uso do plano, para explicar o motivo */
  limitTables: ('quotes' | 'company_profiles')[]
  planUse: PlanUse | null
  /** a primeira sincronização deste login terminou (já se sabe o que a conta tem) */
  synced: boolean
}
export const useSyncState = create<SyncUiState>(() => ({
  phase: 'loading',
  pending: 0,
  rejected: 0,
  conflicts: [],
  limitTables: [],
  planUse: null,
  synced: false,
}))
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

async function call<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await rpcClient.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

const numberingRpc: NumberingRpc = {
  reserve: (profileId, quantity) =>
    call<number>('reservar_numeros_orcamento', { p_empresa: profileId, p_quantidade: quantity }),
  setNext: async (profileId, next) =>
    void (await call<number>('definir_proximo_numero', { p_empresa: profileId, p_proximo: next })),
}

export interface ImportResult {
  /** o envio terminou sem erro */
  ok: boolean
  /** itens que o servidor recusou por limite do plano */
  limited: number
}

interface Running {
  importLocal: (data: DataState) => Promise<ImportResult>
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
/**
 * Junta `data` (edição Local ou arquivo de backup) aos dados da conta e envia. Nunca substitui: o que está na
 * conta fica. Em conta sem orçamentos, o envio vai pela função de importação (não conta no limite do plano).
 */
export const importLocal = (data: DataState) => current?.importLocal(data)
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

  /** Empresa → fim do bloco reservado. Só em memória: ao reabrir, a primeira reserva recomeça depois do bloco antigo. */
  const blocks: Blocks = {}

  /** O próximo envio usa a função de importação do servidor (não conta no limite). Só em memória. */
  let importPending = false

  /** Repõe os blocos de números das empresas já sincronizadas. Falha de rede não impede o resto. */
  async function reserveNumbers() {
    for (const profile of useStore.getState().profiles) {
      if (!engine.isSynced('company_profiles', profile.id)) continue // o servidor ainda não conhece a empresa
      try {
        const used = maxUsedNumber(profile, useStore.getState().quotes)
        const r = await reserveBlock(numberingRpc, profile, blocks[profile.id], used)
        if (!r) continue
        blocks[profile.id] = r.end
        // Só sobe: o contador do servidor reflete blocos de outros dispositivos
        if (r.nextNumber > profile.nextNumber) {
          useStore.setState((st) => ({
            profiles: st.profiles.map((p) => (p.id === profile.id ? { ...p, nextNumber: r.nextNumber } : p)),
          }))
        }
      } catch (e) {
        console.error('numeração', e)
      }
    }
  }

  /** Uso do plano e quais recusas são por limite, para o aviso explicar o motivo. */
  async function refreshLimits() {
    const items = engine.rejectedItems.filter((x) => x.reason === 'limite_do_plano')
    const limitTables = [...new Set(items.map((x) => x.table))].filter(
      (t): t is 'quotes' | 'company_profiles' => t === 'quotes' || t === 'company_profiles',
    )
    let planUse = useSyncState.getState().planUse
    if (limitTables.length) {
      try {
        planUse = await call<PlanUse>('uso_do_plano', {})
      } catch {
        /* sem o uso, o aviso fica sem os números */
      }
    }
    ui({ limitTables, planUse })
  }

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
        let r
        if (importPending) {
          importPending = false
          try {
            r = await engine.importAll()
          } catch (e) {
            // Conta com orçamentos próprios: a importação sem limite não vale; segue o envio normal
            if (!(e instanceof Error && e.message.includes('já tem orçamentos'))) throw e
            r = await engine.sync()
          }
        } else {
          r = await engine.sync()
        }
        await reserveNumbers()

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
              `${asking} ${asking === 1 ? 'item mudou' : 'itens mudaram'} em outro dispositivo e precisa da sua decisão. Veja em Ajustes › Dados › Conflitos de sincronização.`,
              'error',
            )
          }
        }
        if (!again) break
      }
      if (!stopped) {
        publishConflicts()
        await refreshLimits()
        ui({ phase: 'idle', pending: engine.pendingCount, rejected: engine.rejectedCount, synced: true })
      }
    } catch (e) {
      console.error('sync', e)
      if (!stopped) ui({ phase: navigator.onLine ? 'error' : 'offline', pending: engine.pendingCount })
    } finally {
      // Offline ou com erro o motor não grava nada, e a cópia local ficaria sem as edições: ao reabrir o app elas
      // sumiriam (o store voltaria ao snapshot antigo, igual à versão conhecida) e nem conflito haveria.
      await saveSnapshot().catch((e) => console.error('sync: snapshot', e))
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
  // Ao esconder a aba (celular trocando de app, que pode ser encerrado depois) grava a cópia local na hora,
  // sem esperar o atraso de 1 s do envio
  const onVisible = () => void (document.visibilityState === 'visible' ? run() : saveSnapshot())
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
    importLocal: async (data) => {
      await inflight.catch(() => undefined)
      const now = useStore.getState()
      importPending = now.quotes.length === 0 // conta sem orçamentos: importa sem contar no limite
      suppress = true
      try {
        useStore.setState(mergeLocalIntoCloud(pickData(now), data))
      } finally {
        suppress = false
      }
      await run()
      return {
        ok: useSyncState.getState().phase === 'idle',
        limited: engine.rejectedItems.filter((x) => x.reason === 'limite_do_plano').length,
      }
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
      ui({ phase: 'loading', pending: 0, rejected: 0, conflicts: [], limitTables: [], planUse: null, synced: false })
      current = null
    },
  }
  publishConflicts()
  ui({ phase: 'idle', pending: 0, rejected: 0 })
  void run()
}
