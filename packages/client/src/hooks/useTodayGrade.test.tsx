// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTestClientHost } from '../testing/test-support/client-host'
import { ClientHostContext, type ClientHost } from './useClientHost'
import { useTodayGrade } from './useTodayGrade'

function Harness(): React.JSX.Element {
  const grade = useTodayGrade()

  return <output>{grade ?? 'none'}</output>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ now: new Date('2026-10-30T14:00:00.000Z') })
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

let host: ClientHost

function installApi(getTodayGrade: ClientHost['getTodayGrade']) {
  const api = { getTodayGrade: vi.fn(getTodayGrade) }
  host = createTestClientHost(api)

  return api
}

function render(): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <Harness />
      </ClientHostContext>
    )
  )
}

function shown(): string | null {
  return container.querySelector('output')!.textContent
}

it('받은 등급 퍼센트를 보이고, 만료 시각이 지나면 다시 받는다', async () => {
  const api = installApi(async () => ({ percent: 85, expiresAt: '2026-10-30T15:00:00.000Z' }))
  await render()

  expect(shown()).toBe('85')
  expect(api.getTodayGrade).toHaveBeenCalledOnce()

  api.getTodayGrade.mockResolvedValueOnce({ percent: 92, expiresAt: '2026-10-31T15:00:00.000Z' })
  await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000))

  expect(api.getTodayGrade).toHaveBeenCalledTimes(2)
  expect(shown()).toBe('92')
})

it('받았던 등급을 만료 뒤 다시 받지 못하면 값 없이 둔다', async () => {
  const api = installApi(async () => ({ percent: 85, expiresAt: '2026-10-30T15:00:00.000Z' }))
  await render()

  expect(shown()).toBe('85')

  api.getTodayGrade.mockRejectedValueOnce(new Error('TODAY_GRADE_UNAVAILABLE'))
  await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000))

  expect(api.getTodayGrade).toHaveBeenCalledTimes(2)
  expect(shown()).toBe('none')
})

it('만료가 이미 지난 등급을 받아도 1분 안에 다시 받지 않는다', async () => {
  const api = installApi(async () => ({ percent: 85, expiresAt: '2026-10-30T13:00:00.000Z' }))
  await render()
  await act(async () => vi.advanceTimersByTimeAsync(59 * 1000))

  expect(api.getTodayGrade).toHaveBeenCalledOnce()

  await act(async () => vi.advanceTimersByTimeAsync(1000))

  expect(api.getTodayGrade).toHaveBeenCalledTimes(2)
})
