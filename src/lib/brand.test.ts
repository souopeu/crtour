import { describe, expect, test } from 'vitest'
import { APP_NAME } from './brand'

describe('brand', () => {
  test('exposes the app name', () => {
    expect(APP_NAME).toBe('crTOUR')
  })
})
