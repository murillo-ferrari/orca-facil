import { describe, expect, it } from 'vitest'
import { quoteBelongsToClient } from './clientQuotes'
import { clientToQuoteClient, emptyQuoteClient, newClient, newProfile, newQuote } from '../store/factories'

const maria = { ...newClient(), name: 'Maria Oliveira', document: '529.982.247-25' }
const base = newQuote(newProfile(), 'ORC-0001')

describe('quoteBelongsToClient', () => {
  it('vinculado pelo cadastro', () => {
    expect(quoteBelongsToClient({ ...base, client: clientToQuoteClient(maria) }, maria)).toBe(true)
  })
  it('vinculado a outro cliente não conta, mesmo com o mesmo CPF', () => {
    const other = { ...clientToQuoteClient(maria), clientId: 'outro' }
    expect(quoteBelongsToClient({ ...base, client: other }, maria)).toBe(false)
  })
  it('digitado à mão com o mesmo CPF (com ou sem máscara) conta', () => {
    const typed = { ...emptyQuoteClient(), name: 'Maria O.', document: '52998224725' }
    expect(quoteBelongsToClient({ ...base, client: typed }, maria)).toBe(true)
  })
  it('só o nome igual não basta (evita misturar homônimos)', () => {
    const typed = { ...emptyQuoteClient(), name: 'Maria Oliveira' }
    expect(quoteBelongsToClient({ ...base, client: typed }, maria)).toBe(false)
  })
  it('cliente sem documento não "captura" orçamentos sem documento', () => {
    const semDoc = { ...maria, document: '' }
    expect(quoteBelongsToClient({ ...base, client: emptyQuoteClient() }, semDoc)).toBe(false)
  })
})
