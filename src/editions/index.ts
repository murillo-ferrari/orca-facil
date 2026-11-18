import type { DataPersistence } from '../data/persistence'
import { localPersistence } from './local/persistence'

/** Edição definida no build por VITE_EDITION (validada em vite.config.ts). */
export const EDITION = import.meta.env.VITE_EDITION

/**
 * Persistência da edição atual. Hoje só existe a Local; a Cloud entra na fase F5 do plano
 * (docs/plano-versao-cloud.md, seção 7), carregada por import() dinâmico para não pesar no bundle Local.
 */
export const persistence: DataPersistence = localPersistence
