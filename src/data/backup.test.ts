import { describe, expect, it } from 'vitest'
import { BackupError, backupFileName, createBackup, parseBackup } from './backup'
import { migrateState } from './schema'
import { newProfile } from '../store/factories'

const state = { ...migrateState({}, 0), profiles: [newProfile()] }
const now = new Date('2026-11-18T15:00:00Z')

describe('createBackup', () => {
  it('gera o envelope com versões e só os dados', () => {
    const b = createBackup({ ...state, extra: 'não vai' } as never, now)
    expect(b).toMatchObject({ app: 'gerador-orcamento', version: 1, schemaVersion: 2, exportedAt: now.toISOString() })
    expect(b.data).toEqual(state)
  })
  it('nome do arquivo com a data', () => expect(backupFileName(now)).toBe('backup-orcamentos-2026-11-18.json'))
})

describe('parseBackup', () => {
  it('lê o que createBackup gera (ida e volta)', () => {
    expect(parseBackup(JSON.stringify(createBackup(state, now)))).toEqual(state)
  })
  it('aceita o estado "puro", sem envelope', () => {
    expect(parseBackup(JSON.stringify(state))).toEqual(state)
  })
  it.each([
    ['texto que não é JSON', 'isto não é json', 'JSON válido'],
    ['JSON sem orçamentos', JSON.stringify({ profiles: [] }), 'não parece um backup'],
    ['null', 'null', 'não parece um backup'],
  ])('rejeita %s com mensagem clara', (_, text, msg) => {
    expect(() => parseBackup(text)).toThrow(BackupError)
    expect(() => parseBackup(text)).toThrow(msg)
  })
})
