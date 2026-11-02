// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./WebClient', () => ({ default: () => <div data-testid="web-client" /> }))

const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  fetchMock.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('첫 화면에 웹 앱을 두고 Desktop 안내와 내려받기 링크는 두지 않는다', async () => {
  await act(async () => root.render(<App />))

  const webApp = container.querySelector('section[aria-label$="웹 앱"]')

  expect(webApp?.querySelector('[data-testid="web-client"]')).not.toBeNull()
  expect(container.textContent).not.toContain('Desktop')
  expect(container.querySelector('a[href*="/releases"]')).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('서버로 보내는 정보와 지원 범위를 사이트에 적는다', async () => {
  await act(async () => root.render(<App />))

  const text = container.textContent
  expect(text).toContain('api.dfragon.com으로 보내요')
  expect(text).toContain('API가 네오플에서 받아 전달해요')
  expect(text).toContain('브라우저 밖으로 나가지 않아요')
  expect(text).toContain('데스크톱 브라우저용')
  expect(text).toContain('휴대폰은 지원하지 않고')
})
