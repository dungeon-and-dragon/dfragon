import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('브라우저 밖에서는 DFRAGON_API_ORIGIN을 API 주소로 쓴다', async () => {
  vi.stubEnv('DFRAGON_API_ORIGIN', 'http://api.internal.test:3000')

  const { API_BASE_URL } = await import('./dfragon-api')

  expect(API_BASE_URL).toBe('http://api.internal.test:3000')
})

it('브라우저 밖에서 DFRAGON_API_ORIGIN이 없으면 모듈을 읽을 때 실패한다', async () => {
  vi.stubEnv('DFRAGON_API_ORIGIN', undefined)

  await expect(import('./dfragon-api')).rejects.toThrow('DFRAGON_API_ORIGIN')
})
