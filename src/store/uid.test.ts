import { afterEach, expect, it, vi } from 'vitest'
import { uid } from './factories'

afterEach(() => vi.unstubAllGlobals())

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

it('gera UUID v4 com randomUUID e também sem ele (contexto não seguro)', () => {
  expect(uid()).toMatch(UUID_V4)
  vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
  const ids = new Set(Array.from({ length: 50 }, uid))
  expect(ids.size).toBe(50)
  for (const id of ids) expect(id).toMatch(UUID_V4)
})
