import { describe, expect, test } from 'vitest'
import { urlDoSite } from './site'

describe('urlDoSite', () => {
  test('uses the configured site URL and never the request headers', () => {
    expect(urlDoSite({ NEXT_PUBLIC_SITE_URL: 'https://crtour.com.br/', NODE_ENV: 'production' }, 'https://evil.com')).toBe('https://crtour.com.br')
    expect(urlDoSite({ NEXT_PUBLIC_SITE_URL: 'https://crtour.com.br/algum/caminho?x=1', NODE_ENV: 'development' }, 'https://evil.com')).toBe('https://crtour.com.br')
  })

  test('in development falls back to the request origin', () => {
    expect(urlDoSite({ NODE_ENV: 'development' }, 'http://localhost:3000')).toBe('http://localhost:3000')
  })

  test('in production without configuration refuses instead of trusting headers', () => {
    expect(urlDoSite({ NODE_ENV: 'production' }, 'https://evil.com')).toBeNull()
  })

  test.each(['javascript:alert(1)', 'ftp://x.com', 'não é url', ''])('ignores invalid configured value %j', (valor) => {
    expect(urlDoSite({ NEXT_PUBLIC_SITE_URL: valor, NODE_ENV: 'production' }, null)).toBeNull()
  })

  test('ignores an invalid header origin in development', () => {
    expect(urlDoSite({ NODE_ENV: 'development' }, 'javascript:alert(1)')).toBeNull()
    expect(urlDoSite({ NODE_ENV: 'development' }, null)).toBeNull()
  })
})
