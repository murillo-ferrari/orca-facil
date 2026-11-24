import { beforeEach, describe, expect, it } from 'vitest'
import { answerConfirm, confirmDialog, useConfirm } from './confirm'

const opts = { title: 'Excluir', message: 'Excluir o item?' }

beforeEach(() => useConfirm.setState({ pending: null }))

describe('confirmDialog', () => {
  it('abre o pedido e resolve true ao confirmar', async () => {
    const p = confirmDialog(opts)
    expect(useConfirm.getState().pending).toMatchObject(opts)
    answerConfirm(true)
    await expect(p).resolves.toBe(true)
    expect(useConfirm.getState().pending).toBeNull()
  })

  it('resolve false ao cancelar', async () => {
    const p = confirmDialog(opts)
    answerConfirm(false)
    await expect(p).resolves.toBe(false)
  })

  it('um segundo pedido cancela o primeiro, que ainda estava aberto', async () => {
    const first = confirmDialog(opts)
    const second = confirmDialog({ ...opts, title: 'Outro' })
    await expect(first).resolves.toBe(false)
    expect(useConfirm.getState().pending?.title).toBe('Outro')
    answerConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('responder sem pedido aberto não faz nada', () => {
    expect(() => answerConfirm(true)).not.toThrow()
  })

  it('guarda as opções de ação destrutiva', () => {
    void confirmDialog({ ...opts, danger: true, confirmLabel: 'Excluir' })
    expect(useConfirm.getState().pending).toMatchObject({ danger: true, confirmLabel: 'Excluir' })
    answerConfirm(false)
  })
})
