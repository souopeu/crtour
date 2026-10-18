import { describe, expect, test } from 'vitest'
import { lerCorpoAte } from './corpo'

describe('lerCorpoAte', () => {
  const emPartes = (partes: string[]) => new Request('https://x.dev', {
    method: 'POST',
    body: new ReadableStream({ start(c) { for (const p of partes) c.enqueue(new TextEncoder().encode(p)); c.close() } }),
    duplex: 'half',
  } as RequestInit)

  test('reads a small body', async () => {
    expect(await lerCorpoAte(emPartes(['{"a":', '1}']), 64)).toBe('{"a":1}')
  })

  test('stops a body without content-length as soon as it passes the limit', async () => {
    expect(await lerCorpoAte(emPartes(['x'.repeat(40), 'y'.repeat(40)]), 64)).toBeNull()
  })

  test('an empty request is an empty body', async () => {
    expect(await lerCorpoAte(new Request('https://x.dev', { method: 'POST' }), 64)).toBe('')
  })
})
