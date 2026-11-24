import { describe, expect, it } from 'vitest'
import { BLOCK, reserveBlock, type NumberingRpc } from './numbering'

/** Servidor falso: `reserve` avança o contador e devolve o primeiro número (como o RPC). */
class FakeNumbering implements NumberingRpc {
  reserves = 0
  sets = 0
  counter: number
  constructor(counter = 1) {
    this.counter = counter
  }

  reserve = (_id: string, quantity: number) => {
    this.reserves++
    const first = this.counter
    this.counter += quantity
    return Promise.resolve(first)
  }

  setNext = (_id: string, next: number) => {
    this.sets++
    this.counter = next
    return Promise.resolve()
  }
}
const server = (start = 1) => {
  const f = new FakeNumbering(start)
  return Object.assign(f, { rpc: f as NumberingRpc })
}

describe('reserveBlock', () => {
  it('primeira reserva: o bloco começa onde o servidor está', async () => {
    const s = server(1)
    expect(await reserveBlock(s.rpc, { id: 'p', nextNumber: 1 }, undefined)).toEqual({ end: 1 + BLOCK, nextNumber: 1 })
  })

  it('servidor à frente (outro dispositivo já usou números): o próximo número pula para o bloco novo', async () => {
    const s = server(40)
    expect(await reserveBlock(s.rpc, { id: 'p', nextNumber: 3 }, undefined)).toEqual({
      end: 40 + BLOCK,
      nextNumber: 40,
    })
  })

  it('com folga suficiente, não chama o servidor', async () => {
    const s = server(1)
    expect(await reserveBlock(s.rpc, { id: 'p', nextNumber: 3 }, 6)).toBeNull()
    expect(s.reserves + s.sets).toBe(0)
  })

  it('bloco quase no fim e ninguém reservou no meio: estende sem pular número', async () => {
    const s = server(6) // o servidor está exatamente no fim do bloco anterior (1 a 5)
    expect(await reserveBlock(s.rpc, { id: 'p', nextNumber: 5 }, 6)).toEqual({ end: 6 + BLOCK, nextNumber: 5 })
  })

  it('dois dispositivos nunca recebem o mesmo número', async () => {
    const s = server(1)
    const a = await reserveBlock(s.rpc, { id: 'p', nextNumber: 1 }, undefined)
    const b = await reserveBlock(s.rpc, { id: 'p', nextNumber: 1 }, undefined)
    expect(a).toEqual({ end: 6, nextNumber: 1 }) // A: 1 a 5
    expect(b).toEqual({ end: 11, nextNumber: 6 }) // B: 6 a 10

    // A gasta 1 a 4 e repõe: o contador está em 11 (B reservou no meio), então A pula para o bloco novo
    const a2 = await reserveBlock(s.rpc, { id: 'p', nextNumber: 5 }, a!.end)
    expect(a2).toEqual({ end: 16, nextNumber: 11 })
  })

  it('servidor muito atrás do uso local (número digitado à mão ou criado offline): leva o contador adiante em 2 chamadas', async () => {
    const s = server(1)
    const r = await reserveBlock(s.rpc, { id: 'p', nextNumber: 1000 }, undefined)
    expect(r).toEqual({ end: 1000 + BLOCK, nextNumber: 1000 })
    expect(s.counter).toBe(1000 + BLOCK)
    expect([s.reserves, s.sets]).toEqual([1, 1])
  })

  it('servidor pouco atrás: o bloco reservado ainda cobre o número local, sem mexer no contador', async () => {
    const s = server(203)
    const r = await reserveBlock(s.rpc, { id: 'p', nextNumber: 205 }, undefined)
    expect(r).toEqual({ end: 208, nextNumber: 205 })
    expect(s.sets).toBe(0)
  })

  it('números já usados que o servidor não conhece: o bloco começa depois deles', async () => {
    const s = server(1) // contador nunca avançou (empresa criada antes da reserva)
    const r = await reserveBlock(s.rpc, { id: 'p', nextNumber: 1 }, undefined, 7)
    expect(r).toEqual({ end: 8 + BLOCK, nextNumber: 8 })
    expect(s.counter).toBe(8 + BLOCK) // o contador do servidor foi levado para depois do bloco
  })

  it('número usado dentro dos blocos já reservados não muda nada', async () => {
    const s = server(11)
    expect(await reserveBlock(s.rpc, { id: 'p', nextNumber: 1 }, undefined, 8)).toEqual({ end: 16, nextNumber: 11 })
    expect(s.sets).toBe(0)
  })

  it('erro do servidor propaga (o controlador trata e tenta de novo depois)', async () => {
    const rpc: NumberingRpc = {
      reserve: () => Promise.reject(new Error('empresa não encontrada')),
      setNext: () => Promise.resolve(),
    }
    await expect(reserveBlock(rpc, { id: 'p', nextNumber: 1 }, undefined)).rejects.toThrow('empresa não encontrada')
  })
})
