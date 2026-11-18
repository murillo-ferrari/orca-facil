import { createJSONStorage } from 'zustand/middleware'
import type { DataPersistence } from '../../data/persistence'
import type { DataState } from '../../data/schema'

/** Edição Local: tudo no localStorage deste navegador. */
export const localPersistence: DataPersistence = {
  edition: 'local',
  storage: createJSONStorage<DataState>(() => localStorage),
}
