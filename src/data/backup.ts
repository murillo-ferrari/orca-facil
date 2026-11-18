import { SCHEMA_VERSION, pickData, type DataState } from './schema'

/** Formato do arquivo de backup (Ajustes › Exportar). Também será a porta de entrada da migração Local → Cloud. */
export interface BackupFile {
  app: 'gerador-orcamento'
  /** Versão do formato do arquivo (envelope) */
  version: 1
  /** Versão do formato dos dados dentro de `data` */
  schemaVersion: number
  exportedAt: string
  data: DataState
}

export class BackupError extends Error {}

export function createBackup(state: DataState, now = new Date()): BackupFile {
  return {
    app: 'gerador-orcamento',
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data: pickData(state),
  }
}

export const backupFileName = (now = new Date()) => `backup-orcamentos-${now.toISOString().slice(0, 10)}.json`

/**
 * Lê o conteúdo de um arquivo de backup. Aceita o envelope `{ app, version, data }` e também o estado "puro"
 * (backups antigos ou montados à mão). Não normaliza: isso fica com `normalizeImport`.
 */
export function parseBackup(text: string): Partial<DataState> {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.')
  }
  const data = ((json as { data?: unknown })?.data ?? json) as Partial<DataState> | null
  if (!data || !Array.isArray(data.profiles) || !Array.isArray(data.quotes)) {
    throw new BackupError('O arquivo não parece um backup do gerador de orçamentos.')
  }
  return data
}
