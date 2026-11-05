import { expect, it, vi } from 'vitest'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'

function readTodayGrade(body: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify(body), { status })
  )
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).items.todayGrade()

  return { fetch, read }
}

it('오늘의 등급 응답에서 percent와 expiresAt만 읽는다', async () => {
  const { fetch, read } = readTodayGrade({
    percent: 85,
    expiresAt: '2026-11-06T15:00:00.000Z',
    extra: true
  })

  await expect(read).resolves.toEqual({ percent: 85, expiresAt: '2026-11-06T15:00:00.000Z' })
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(`${API_ORIGIN}/items/today-grade`)
})

it.each([
  ['정수가 아닌 percent', { percent: 85.5, expiresAt: '2026-11-06T15:00:00.000Z' }],
  ['100을 넘는 percent', { percent: 101, expiresAt: '2026-11-06T15:00:00.000Z' }],
  ['Date.parse로 읽지 못하는 expiresAt', { percent: 85, expiresAt: '내일' }]
])('%s 응답은 SEARCH_RESPONSE_INVALID로 거절한다', async (_case, body) => {
  await expect(readTodayGrade(body).read).rejects.toMatchObject({
    code: 'SEARCH_RESPONSE_INVALID'
  })
})

it.each([
  [500, 'INTERNAL_SERVER_ERROR'],
  [502, 'NEOPLE_API_ERROR'],
  [503, 'NEOPLE_UNAVAILABLE'],
  [504, 'NEOPLE_TIMEOUT']
])('%i %s 응답은 같은 code로 실패하고 API 문구를 준다', async (status, code) => {
  const message = '오늘의 등급 오류 문구'

  await expect(readTodayGrade({ error: { code, message } }, status).read).rejects.toMatchObject({
    code,
    message
  })
})
