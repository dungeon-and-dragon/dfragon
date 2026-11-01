// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterImage } from '../../../../preload/common/types/character'
import { installBrowserHost, type BrowserHost } from './browser-host'
import { decodeBrowserImage } from './browser-png'

vi.mock('./browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))

const API_ORIGIN = 'https://api.example.test'
const image: CharacterImage = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
const file = new File([new Uint8Array([1])], 'shot.png', { type: 'image/png' })

function pasteEvent(items: Array<Partial<DataTransferItem>>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { items } })

  return event
}

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
}

let host: BrowserHost

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(API_ORIGIN)
})

beforeEach(() => {
  vi.mocked(decodeBrowserImage).mockResolvedValue(image)
})

afterEach(() => {
  vi.resetAllMocks()
})

it('페이지에 이미지를 붙여 넣으면 알리고 readCaptureFrame이 그 이미지를 프레임으로 돌려준다', async () => {
  const pasted = vi.fn()
  const unsubscribe = host.onPastedFrame(pasted)
  await expect(window.api.readCaptureFrame('capture')).rejects.toThrow('NO_PASTED_FRAME')

  document.dispatchEvent(pasteEvent([{ kind: 'string', type: 'text/plain' }]))
  expect(pasted).not.toHaveBeenCalled()

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  expect(pasted).toHaveBeenCalledOnce()
  await expect(window.api.readCaptureFrame('capture')).resolves.toEqual({ kind: 'frame', image })
  expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(file)
  unsubscribe()
})

it('붙여 넣은 이미지를 읽지 못하면 readCaptureFrame이 거절한다', async () => {
  vi.mocked(decodeBrowserImage).mockRejectedValue(new Error('broken'))

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))

  await expect(window.api.readCaptureFrame('capture')).rejects.toThrow('broken')
})

it('페이지의 Alt+W, Alt+A를 Desktop 단축키로 알리고 다른 조합은 브라우저에 넘긴다', () => {
  const received = vi.fn()
  const unsubscribe = window.desktopShortcut.onDesktopShortcut(received)

  const snapshot = keydown({ code: 'KeyW', key: 'ㅈ', altKey: true })
  document.body.dispatchEvent(snapshot)
  const copy = keydown({ code: 'KeyA', key: 'a', altKey: true })
  document.body.dispatchEvent(copy)
  const withShift = keydown({ code: 'KeyW', key: 'W', altKey: true, shiftKey: true })
  document.body.dispatchEvent(withShift)
  const restart = keydown({ code: 'KeyR', key: 'r', altKey: true })
  document.body.dispatchEvent(restart)

  expect(received.mock.calls).toEqual([['take-snapshot'], ['copy-clipboard']])
  expect(snapshot.defaultPrevented).toBe(true)
  expect(copy.defaultPrevented).toBe(true)
  expect(withShift.defaultPrevented).toBe(false)
  expect(restart.defaultPrevented).toBe(false)

  unsubscribe()
  document.body.dispatchEvent(keydown({ code: 'KeyA', key: 'a', altKey: true }))
  expect(received).toHaveBeenCalledTimes(2)
})
