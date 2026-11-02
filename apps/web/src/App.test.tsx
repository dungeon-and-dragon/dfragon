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

it('첫 화면에 웹 앱 상자와 Neople 로고 링크만 두고 상단 바, 푸터, 사이트 문구는 두지 않는다', async () => {
  await act(async () => root.render(<App />))

  const neopleLink = container.querySelector('a[href="https://developers.neople.co.kr"]')

  expect(neopleLink?.querySelector('img')?.getAttribute('alt')).toBe('Neople 오픈 API')
  expect(container.querySelector('header, footer, h1')).toBeNull()
  expect(container.textContent).toBe('')
})
