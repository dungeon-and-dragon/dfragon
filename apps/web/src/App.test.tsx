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

it('페이지에 웹 앱을 두고 Desktop 안내와 내려받기 링크는 두지 않는다', async () => {
  await act(async () => root.render(<App />))

  expect(container.querySelector('[data-testid="web-client"]')).not.toBeNull()
  expect(container.textContent).not.toContain('Desktop')
  expect(container.querySelector('a[href*="/releases"]')).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('전역 바와 화면은 웹 앱에 맡기고 페이지는 그 아래에 Neople 로고 링크만 더하며 푸터와 사이트 문구는 두지 않는다', async () => {
  await act(async () => root.render(<App />))

  const webClient = container.querySelector('[data-testid="web-client"]')!
  const neopleLink = container.querySelector('a[href="https://developers.neople.co.kr"]')!
  expect(neopleLink.querySelector('img')?.getAttribute('alt')).toBe('Neople 오픈 API')
  expect(webClient.compareDocumentPosition(neopleLink) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
    0
  )
  expect(container.querySelector('header, footer, h1')).toBeNull()
  expect(container.textContent).toBe('')
})
