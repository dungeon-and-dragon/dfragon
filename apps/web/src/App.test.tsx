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

it('웹 앱 아래 푸터에 Neople 로고 링크, 이용약관, 개인정보처리방침을 두고 약관은 아직 링크가 아니다', async () => {
  await act(async () => root.render(<App />))

  const webClient = container.querySelector('[data-testid="web-client"]')!
  const footer = container.querySelector('footer')!
  const neopleLink = footer.querySelector('a[href="https://developers.neople.co.kr"]')!
  expect(webClient.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(neopleLink.getAttribute('target')).toBe('_blank')
  expect(neopleLink.querySelector('img')?.getAttribute('alt')).toBe('Neople 오픈 API')
  expect(footer.textContent).toBe('이용약관개인정보처리방침')
  expect(footer.querySelectorAll('a')).toHaveLength(1)
})

it('푸터 밖에 빌드 commit을 두고 숨긴 라벨과 함께 빌드 commit으로 읽히게 한다', async () => {
  await act(async () => root.render(<App />))

  const label = [...container.querySelectorAll('span')].find(
    (span) => span.textContent === '빌드 '
  )!
  const buildCommit = label.parentElement!
  expect(buildCommit.textContent).toBe(`빌드 ${__BUILD_COMMIT__}`)
  expect(buildCommit.closest('footer, a')).toBeNull()
  expect(container.querySelector('header, h1')).toBeNull()
  expect(container.textContent).toBe(`이용약관개인정보처리방침빌드 ${__BUILD_COMMIT__}`)
})
