import { describe, expect, it } from 'vitest'
import { SyncEngine, TABLES, conflictKey, type RpcClient, type ServerRow, type SyncDb, type Table } from './engine'
import type { Synced } from './diff'

/** Servidor falso: mesma lógica dos RPCs (base_rev nulo = novo; rev diferente = conflito; paginação por updated_at). */
class FakeServer implements RpcClient {
  rows = Object.fromEntries(TABLES.map((t) => [t, new Map<string, ServerRow>()])) as Record<
    Table,
    Map<string, ServerRow>
  >
  clock = 0
  calls = { push: 0, pull: 0 }
  /** ids que o servidor recusa por falta de plano Pro */
  refuse = new Set<string>()
  private stamp = () => new Date(Date.UTC(2026, 0, 1) + ++this.clock * 1000).toISOString()

  rpc(fn: string, args: Record<string, unknown>) {
    const push = fn === 'aplicar_alteracoes'
    return Promise.resolve({ data: push ? this.apply(args) : this.pull(args), error: null })
  }

  private apply(args: Record<string, unknown>) {
    this.calls.push++
    const out = { applied: [] as unknown[], conflicts: [] as unknown[], rejected: [] as unknown[] }
    for (const c of args.p_changes as {
      table: Table
      id: string
      base_rev: number | null
      deleted: boolean
      data: unknown
    }[]) {
      const rows = this.rows[c.table]
      const cur = rows.get(c.id)
      if ('data' in c && c.data === null) {
        // Igual ao banco: JSON null não é SQL NULL e viola a constraint "data é objeto"
        out.rejected.push({ table: c.table, id: c.id, reason: 'dados_invalidos' })
        continue
      }
      if (this.refuse.has(c.id)) {
        out.rejected.push({ table: c.table, id: c.id, reason: 'sem_permissao' })
        continue
      }
      if ((c.base_rev === null && cur) || (c.base_rev !== null && cur?.rev !== c.base_rev)) {
        out.conflicts.push({ table: c.table, id: c.id, server: cur ?? null })
        continue
      }
      const row: ServerRow = {
        id: c.id,
        rev: (cur?.rev ?? 0) + 1,
        updated_at: this.stamp(),
        deleted_at: c.deleted ? this.stamp() : null,
        data: c.data ?? cur?.data,
      }
      rows.set(c.id, row)
      out.applied.push({ table: c.table, id: c.id, rev: row.rev })
    }
    return out
  }

  private pull(args: Record<string, unknown>) {
    this.calls.pull++
    const since = args.p_desde as string
    const limit = args.p_limite as number
    const out: Record<string, unknown> = { server_time: this.stamp() }
    for (const t of TABLES) {
      const rows = [...this.rows[t].values()]
        .filter((r) => since === '-infinity' || r.updated_at > since)
        .sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1))
        .slice(0, limit)
      out[t] = { rows, has_more: rows.length === limit }
    }
    return out
  }

  /** Alteração feita por outro dispositivo, direto no servidor */
  put(table: Table, id: string, data: unknown, deleted = false) {
    const cur = this.rows[table].get(id)
    this.rows[table].set(id, {
      id,
      rev: (cur?.rev ?? 0) + 1,
      updated_at: this.stamp(),
      deleted_at: deleted ? this.stamp() : null,
      data,
    })
  }
}

const memoryDb = (): SyncDb & { map: Map<string, unknown> } => {
  const map = new Map<string, unknown>()
  return { map, get: async (k) => map.get(k), set: async (k, v) => void map.set(k, structuredClone(v)) }
}

/** Um dispositivo: motor + "store" local (lista de clientes) alimentado pelas mudanças remotas */
async function device(server: FakeServer, db = memoryDb(), pageSize?: number) {
  let clients: Synced[] = []
  const engine = new SyncEngine(
    db,
    server,
    (table, ch) => {
      if (table !== 'clients') return
      clients = clients.filter((c) => !ch.deletedIds.includes(c.id) && !ch.upserts.some((u) => u.id === c.id))
      clients.push(...(ch.upserts.map((u) => u.data) as Synced[]))
    },
    { pageSize },
  )
  await engine.load()
  return {
    engine,
    db,
    get clients() {
      return clients
    },
    set: (next: Synced[]) => (clients = next),
    sync: async () => {
      await engine.capture('clients', clients)
      return engine.sync()
    },
  }
}

const cli = (id: string, name: string) => ({ id, name })

describe('SyncEngine', () => {
  it('envia registro novo e não trata o eco como novidade', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    const r = await a.sync()
    expect(r).toMatchObject({ applied: 1, conflicts: 0, pulled: 0 })
    expect(server.rows.clients.get('1')?.rev).toBe(1)
  })

  it('segunda edição usa a rev devolvida pelo servidor como base', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()
    a.set([cli('1', 'Ana Maria')])
    expect(await a.sync()).toMatchObject({ applied: 1, conflicts: 0 })
    expect(server.rows.clients.get('1')).toMatchObject({ rev: 2, data: { name: 'Ana Maria' } })
  })

  it('sem mudança, não chama o servidor para enviar', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()
    const antes = server.calls.push
    await a.sync()
    expect(server.calls.push).toBe(antes)
  })

  it('traz o que outro dispositivo criou, alterou e apagou', async () => {
    const server = new FakeServer()
    const a = await device(server)
    server.put('clients', '1', cli('1', 'Bia'))
    expect((await a.sync()).pulled).toBe(1)
    expect(a.clients).toEqual([cli('1', 'Bia')])

    server.put('clients', '1', cli('1', 'Bia Souza'))
    await a.sync()
    expect(a.clients).toEqual([cli('1', 'Bia Souza')])

    server.put('clients', '1', null, true)
    await a.sync()
    expect(a.clients).toEqual([])
  })

  it('conflito: servidor prevalece e a versão local vai para "substituídas"', async () => {
    const server = new FakeServer()
    const a = await device(server)
    const b = await device(server)
    a.set([cli('1', 'Original')])
    await a.sync()
    await b.sync() // b recebe rev 1

    a.set([cli('1', 'Edição do A')])
    await a.sync() // servidor vai a rev 2

    b.set([cli('1', 'Edição do B')]) // b ainda está na rev 1
    const r = await b.sync()

    expect(r.conflicts).toBe(1)
    expect(b.clients).toEqual([cli('1', 'Edição do A')])
    expect(b.engine.conflicts).toMatchObject([
      {
        table: 'clients',
        id: '1',
        local: cli('1', 'Edição do B'),
        server: cli('1', 'Edição do A'),
        base: cli('1', 'Original'),
        serverRev: 2,
      },
    ])
    // Resolver (ou descartar) tira o conflito da lista e grava
    await b.engine.dismissConflict(conflictKey(b.engine.conflicts[0]))
    expect(b.engine.conflicts).toEqual([])
  })

  it('exclusão local é enviada sem o campo data e vira exclusão no servidor', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()
    a.set([])
    expect(await a.sync()).toMatchObject({ applied: 1, rejected: [] })
    expect(server.rows.clients.get('1')?.deleted_at).not.toBeNull()
  })

  it('exclusão local de registro alterado em outro dispositivo é conflito, e o registro volta', async () => {
    const server = new FakeServer()
    const a = await device(server)
    const b = await device(server)
    a.set([cli('1', 'X')])
    await a.sync()
    await b.sync()
    a.set([cli('1', 'X editado')])
    await a.sync()

    b.set([]) // b apaga sem ter visto a edição
    await b.sync()

    expect(b.clients).toEqual([cli('1', 'X editado')])
    expect(b.engine.conflicts[0].local).toBeNull()
  })

  it('recriar item excluído na nuvem: dismiss com revive faz o próximo envio desfazer a exclusão', async () => {
    const server = new FakeServer()
    const a = await device(server)
    const b = await device(server)
    a.set([cli('1', 'Original')])
    await a.sync()
    await b.sync()

    a.set([]) // A exclui
    await a.sync()
    b.set([cli('1', 'Editado no B')]) // B edita sem saber
    const r = await b.sync()
    expect(r.conflicts).toBe(1)
    expect(b.engine.conflicts[0]).toMatchObject({ server: null, local: cli('1', 'Editado no B') })

    const key = conflictKey(b.engine.conflicts[0])
    b.set([cli('1', 'Editado no B')]) // a pessoa escolheu manter o seu: o app recoloca o item
    await b.engine.dismissConflict(key, { revive: true })
    expect((await b.sync()).applied).toBe(1)
    expect(server.rows.clients.get('1')).toMatchObject({ deleted_at: null, data: { name: 'Editado no B' } })
  })

  it('recusa do servidor (sem plano Pro) não é reenviada em laço; editar o registro tenta de novo', async () => {
    const server = new FakeServer()
    server.refuse.add('1')
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    const r = await a.sync()
    expect(r.rejected).toEqual([{ table: 'clients', id: '1', reason: 'sem_permissao' }])

    const enviadas = server.calls.push
    await a.sync()
    expect(server.calls.push).toBe(enviadas)

    server.refuse.clear()
    a.set([cli('1', 'Ana Maria')])
    expect((await a.sync()).applied).toBe(1)
  })

  it('recusa informa o motivo, e excluir o registro recusado limpa a recusa', async () => {
    const server = new FakeServer()
    server.refuse.add('1')
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()
    expect(a.engine.rejectedItems).toEqual([{ table: 'clients', id: '1', reason: 'sem_permissao' }])
    expect(a.engine.isSynced('clients', '1')).toBe(false)

    a.set([]) // a pessoa desiste do item que o plano não aceitou
    await a.sync()
    expect(a.engine.rejectedCount).toBe(0)
    expect(a.engine.rejectedItems).toEqual([])
  })

  it('isSynced vale depois de enviar e de receber', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()
    expect(a.engine.isSynced('clients', '1')).toBe(true)
    server.put('clients', '2', cli('2', 'Bia'))
    await a.sync()
    expect(a.engine.isSynced('clients', '2')).toBe(true)
  })

  it('pagina o pull até acabar', async () => {
    const server = new FakeServer()
    for (let i = 0; i < 5; i++) server.put('clients', String(i), cli(String(i), `C${i}`))
    const a = await device(server, memoryDb(), 2)
    expect((await a.sync()).pulled).toBe(5)
    expect(a.clients.map((c) => c.id).sort()).toEqual(['0', '1', '2', '3', '4'])
  })

  it('reabrir o app com o mesmo banco não reenvia nem rebusca o que já foi sincronizado', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()

    const a2 = await device(server, a.db)
    a2.set([cli('1', 'Ana')]) // o store recarregado traz o mesmo conteúdo
    const antes = server.calls.push
    const r = await a2.sync()
    expect(server.calls.push).toBe(antes)
    expect(r).toMatchObject({ applied: 0, pulled: 0 })
  })

  it('edição local pendente não é sobrescrita pelo pull: o envio vem antes e vira conflito', async () => {
    const server = new FakeServer()
    const a = await device(server)
    a.set([cli('1', 'Ana')])
    await a.sync()
    server.put('clients', '1', cli('1', 'Do servidor'))

    a.set([cli('1', 'Local')])
    await a.sync()

    expect(a.engine.conflicts[0]?.local).toEqual(cli('1', 'Local'))
    expect(a.clients).toEqual([cli('1', 'Do servidor')])
  })
})
