// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installBrowserHost } from './browser-host'
import { WebApp } from './WebApp'

const API_ORIGIN = 'https://api.example.test'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () =>
      Response.json({ percent: 85, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
    )
  )
  installBrowserHost(API_ORIGIN)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('preload 없이 브라우저 host만으로 상단 바와 파티 카드 네 장을 그린다', async () => {
  await act(async () => root.render(<WebApp />))

  await vi.waitFor(() => expect(container.textContent).toContain('85'))
  expect(container.querySelectorAll('article')).toHaveLength(4)
  expect(vi.mocked(fetch).mock.calls.map((args) => new Request(...args).url)).toContain(
    `${API_ORIGIN}/items/today-grade`
  )
})

it('Desktop과 달리 문서 전체의 드래그를 막지 않는다', async () => {
  await act(async () => root.render(<WebApp />))
  const event = new Event('dragstart', { bubbles: true, cancelable: true })

  document.body.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(false)
})

it('Clipboard API가 없는 페이지에서는 복사를 예외 대신 거절된 Promise로 알린다', async () => {
  vi.stubGlobal('navigator', {})

  const written = window.desktopClipboard.writeText('[가나, 카인, -]')

  await expect(written).rejects.toThrow(TypeError)
})
