import type { DataPersistence } from '../data/persistence'
import { localPersistence } from './local/persistence'

/** Edição definida no build por VITE_EDITION (validada em vite.config.ts). */
export const EDITION = import.meta.env.VITE_EDITION

/**
 * Persistência da edição atual: Local grava no localStorage. Na Cloud o store não grava por conta própria: a cópia local (IndexedDB, por usuário) é gravada pelo
 * controlador de sincronização (editions/cloud/sync/controller.ts), que só sabe qual é o usuário depois do login.
 */
const cloudPersistence: DataPersistence = {
  edition: 'cloud',
  storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
}

export const persistence: DataPersistence = EDITION === 'cloud' ? cloudPersistence : localPersistence
