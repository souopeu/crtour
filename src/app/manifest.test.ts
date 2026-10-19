import { describe, expect, test } from 'vitest'
import manifest from './manifest'

describe('manifest', () => {
  const m = manifest()

  test('is installable and standalone in pt-BR', () => {
    expect(m.name).toBe('crTOUR')
    expect(m.display).toBe('standalone')
    expect(m.lang).toBe('pt-BR')
    expect(m.start_url).toBe('/')
  })

  test('uses the brand blue as theme color', () => {
    expect(m.theme_color).toBe('#f6f7fb')
  })

  test('declares 192, 512 and maskable icons', () => {
    const sizes = (m.icons ?? []).map((i) => `${i.sizes}:${i.purpose ?? 'any'}`)
    expect(sizes).toContain('192x192:any')
    expect(sizes).toContain('512x512:any')
    expect(sizes).toContain('512x512:maskable')
  })
})
