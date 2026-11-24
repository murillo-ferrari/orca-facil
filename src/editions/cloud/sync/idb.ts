import type { SyncDb } from './engine'

/**
 * Armazenamento do motor no IndexedDB nativo: um banco por usuário (`orcafacil:<userId>`) com um único
 * store chave-valor. Não é coberto pelo Vitest (o ambiente de teste não tem IndexedDB); o motor é testado com
 * um Map no lugar.
 */
export function openSyncDb(userId: string): Promise<SyncDb> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(`orcafacil:${userId}`, 1)
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const run = <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) =>
        new Promise<T>((done, fail) => {
          const tx = db.transaction('kv', mode)
          const req = op(tx.objectStore('kv'))
          tx.oncomplete = () => done(req.result)
          tx.onerror = tx.onabort = () => fail(tx.error)
        })
      resolve({
        get: (key) => run('readonly', (s) => s.get(key)),
        set: async (key, value) => void (await run('readwrite', (s) => s.put(value, key))),
        close: () => db.close(),
      })
    }
  })
}

/** Apaga a cópia local de um usuário ("Sair e apagar dados deste dispositivo", exclusão de conta). */
export function deleteSyncDb(userId: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(`orcafacil:${userId}`)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}
