import type { PersistStorage } from 'zustand/middleware'
import type { DataState } from './schema'

/**
 * Onde o store guarda os dados. Cada edição fornece a sua implementação:
 * - Local: localStorage (src/editions/local/persistence.ts)
 * - Cloud (fase F5 do plano): cópia local no IndexedDB por usuário + fila de envio para o Supabase
 *
 * As telas e as ações do store não mudam entre edições; só esta peça muda.
 */
export interface DataPersistence {
  readonly edition: 'local' | 'cloud'
  /** Armazenamento usado pelo middleware `persist` do zustand (pode ser assíncrono) */
  readonly storage: PersistStorage<DataState> | undefined
}
