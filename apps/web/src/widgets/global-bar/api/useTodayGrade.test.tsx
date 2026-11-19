// @vitest-environment jsdom
import { delay, HttpResponse, http, type JsonBodyType } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { server } from '#testing/test-support/msw-server'
import { TODAY_GRADE_URL } from './today-grade.handlers'
import { useTodayGrade } from './useTodayGrade'

function Harness(): React.JSX.Element {
  const grade = useTodayGrade()

  return <output>{grade ?? 'none'}</output>
}

let container: HTMLDivElement
let root: Root
let responses: Response[]
let requestCount: number

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ now: new Date('2026-10-30T14:00:00.000Z') })
  responses = []
  requestCount = 0
  server.use(
    http.get(TODAY_GRADE_URL, async () => {
      requestCount += 1
      const response = responses.shift()

      if (response === undefined) {
        await delay('infinite')
      }

      return response
    })
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function queueResponse(body: JsonBodyType, status = 200): void {
  responses.push(HttpResponse.json(body, { status }))
}

function render(): Promise<void> {
  return act(async () => root.render(<Harness />))
}

function shown(): string | null {
  return container.querySelector('output')!.textContent
}

it('응답을 기다리는 동안 값 없이 둔다', async () => {
  await render()
  await vi.waitFor(() => expect(requestCount).toBe(1))

  expect(shown()).toBe('none')
})

it('받은 등급 퍼센트를 보이고, 만료 시각이 지나면 다시 받는다', async () => {
  queueResponse({ percent: 85, expiresAt: '2026-10-30T15:00:00.000Z', extra: true })
  await render()
  await vi.waitFor(() => expect(shown()).toBe('85'))
  expect(requestCount).toBe(1)

  queueResponse({ percent: 92, expiresAt: '2026-10-31T15:00:00.000Z' })
  await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000))
  await vi.waitFor(() => expect(shown()).toBe('92'))

  expect(requestCount).toBe(2)
})

it('받았던 등급을 만료 뒤 다시 받지 못하면 값 없이 둔다', async () => {
  queueResponse({ percent: 85, expiresAt: '2026-10-30T15:00:00.000Z' })
  await render()
  await vi.waitFor(() => expect(shown()).toBe('85'))

  queueResponse({ error: { code: 'INTERNAL_SERVER_ERROR', message: '오늘의 등급 오류 문구' } }, 500)
  await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000))
  await vi.waitFor(() => expect(shown()).toBe('none'))

  expect(requestCount).toBe(2)
})

it('만료가 이미 지난 등급을 받아도 1분 안에 다시 받지 않는다', async () => {
  queueResponse({ percent: 85, expiresAt: '2026-10-30T13:00:00.000Z' })
  queueResponse({ percent: 85, expiresAt: '2026-10-30T13:00:00.000Z' })
  await render()
  await vi.waitFor(() => expect(shown()).toBe('85'))
  await act(async () => vi.advanceTimersByTimeAsync(59 * 1000))

  expect(requestCount).toBe(1)

  await act(async () => vi.advanceTimersByTimeAsync(1000))

  await vi.waitFor(() => expect(requestCount).toBe(2))
})

it.each([
  ['정수가 아닌 percent', { percent: 85.5, expiresAt: '2026-10-31T15:00:00.000Z' }],
  ['100을 넘는 percent', { percent: 101, expiresAt: '2026-10-31T15:00:00.000Z' }],
  ['Date.parse로 읽지 못하는 expiresAt', { percent: 85, expiresAt: '내일' }]
])('만료 뒤 다시 받은 %s 응답은 값 없이 둔다', async (_case, body) => {
  queueResponse({ percent: 85, expiresAt: '2026-10-30T15:00:00.000Z' })
  queueResponse(body)
  await render()
  await vi.waitFor(() => expect(shown()).toBe('85'))

  await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000))
  await vi.waitFor(() => expect(shown()).toBe('none'))

  expect(requestCount).toBe(2)
})
