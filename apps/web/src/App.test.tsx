// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./WebClient', () => ({ default: () => <div data-testid="web-client" /> }))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('첫 화면에 웹 앱을 두고 내려받기는 보조 안내 안에 둔다', async () => {
  await act(async () => root.render(<App />))

  const webApp = container.querySelector('section[aria-label$="웹 앱"]')
  const desktopNote = [...container.querySelectorAll('section[aria-label="안내"] > div')].find(
    (note) => note.querySelector('h2')?.textContent === '게임 안에서 쓰려면'
  )

  expect(webApp?.querySelector('[data-testid="web-client"]')).not.toBeNull()
  expect(desktopNote?.textContent).toContain('Alt+R')
  expect(desktopNote?.querySelector('a')?.textContent).toBe('Windows용 내려받기')
  expect(container.querySelectorAll('a[href$="/releases/latest"]')).toHaveLength(1)
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
