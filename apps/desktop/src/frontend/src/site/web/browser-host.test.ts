// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it, vi, type Mock } from 'vitest'
import type { CharacterImage } from '../../../../preload/common/types/character'
import { installBrowserHost, type BrowserHost } from './browser-host'
import { decodeBrowserImage } from './browser-png'

vi.mock('./browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))

const API_ORIGIN = 'https://api.example.test'
const image: CharacterImage = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
const sharedImage: CharacterImage = { width: 1, height: 1, rgba: new Uint8Array([9, 9, 9, 255]) }
const file = new File([new Uint8Array([1])], 'shot.png', { type: 'image/png' })

function pasteEvent(items: Array<Partial<DataTransferItem>>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { items } })

  return event
}

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
}

// jsdom에는 화면 공유와 video 재생이 없어 getDisplayMedia가 돌려주는 track과 stream만 흉내 낸다.
function stubScreenShare(): { track: EventTarget & { stop: () => void }; getDisplayMedia: Mock } {
  const track = Object.assign(new EventTarget(), { label: 'Dungeon & Fighter', stop: vi.fn() })
  const getDisplayMedia = vi.fn(async () => ({ getVideoTracks: () => [track] }))
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } })

  return { track, getDisplayMedia }
}

function stubVideoDecode(): void {
  vi.mocked(decodeBrowserImage).mockImplementation(async (source) => {
    if (source instanceof HTMLVideoElement) {
      return sharedImage
    }

    return image
  })
}

let host: BrowserHost

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(API_ORIGIN)
})

beforeEach(() => {
  vi.mocked(decodeBrowserImage).mockResolvedValue(image)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

afterEach(async () => {
  await window.api.selectCaptureSource('')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

it('공유한 창은 목록에 나오지 않고, 캡처 회차는 공유 화면을, 붙여넣기 회차는 붙여 넣은 이미지를 읽는다', async () => {
  const { getDisplayMedia } = stubScreenShare()
  stubVideoDecode()
  const received = vi.fn()
  const unsubscribe = window.desktopShortcut.onDesktopShortcut(received)

  const sourceId = await host.requestScreenShare()

  expect(getDisplayMedia).toHaveBeenCalledExactlyOnceWith({
    video: { displaySurface: 'window' },
    audio: false
  })
  await expect(window.api.listCaptureSources()).resolves.toEqual([])
  await expect(window.api.selectCaptureSource(sourceId!)).resolves.toEqual({
    id: sourceId,
    name: 'Dungeon & Fighter'
  })
  await expect(window.api.readCaptureFrame('capture')).resolves.toEqual({
    kind: 'frame',
    image: sharedImage
  })

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await expect(window.api.readCaptureFrame('capture')).resolves.toEqual({ kind: 'frame', image })
  await expect(window.api.readCaptureFrame('capture')).resolves.toEqual({
    kind: 'frame',
    image: sharedImage
  })

  const restart = keydown({ code: 'KeyR', key: 'ㄱ', altKey: true })
  document.body.dispatchEvent(restart)
  expect(received).toHaveBeenCalledExactlyOnceWith('restart-search')
  expect(restart.defaultPrevented).toBe(true)
  unsubscribe()
})

it('사용자가 공유를 멈추면 끝났다고 알리고, 앱이 끊은 공유와 거절한 요청은 알리지 않는다', async () => {
  const { track } = stubScreenShare()
  stubVideoDecode()
  const ended = vi.fn()
  const unsubscribe = host.onScreenShareEnded(ended)
  const sourceId = await host.requestScreenShare()
  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await window.api.readCaptureFrame('capture')

  track.dispatchEvent(new Event('ended'))

  expect(ended).toHaveBeenCalledOnce()
  await expect(window.api.selectCaptureSource(sourceId!)).rejects.toThrow('SCREEN_SHARE_ENDED')
  await expect(window.api.readCaptureFrame('capture')).resolves.toEqual({ kind: 'frame', image })

  const next = stubScreenShare()
  await host.requestScreenShare()
  await window.api.selectCaptureSource('')
  next.track.dispatchEvent(new Event('ended'))
  expect(next.track.stop).toHaveBeenCalledOnce()

  next.getDisplayMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
  await expect(host.requestScreenShare()).resolves.toBeNull()
  expect(ended).toHaveBeenCalledOnce()
  unsubscribe()
})
