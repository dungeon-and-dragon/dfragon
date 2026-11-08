// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it, vi, type Mock } from 'vitest'
import type { CharacterImage } from '#core/character/character'
import { decodeBrowserImage } from '../browser-png'
import type { BrowserHost } from '../client-host'
import { createRoundFrames } from './round-frames'
import { createScreenShare } from './screen-share'

vi.mock('../browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))

const image: CharacterImage = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
const sharedImage: CharacterImage = { width: 1, height: 1, rgba: new Uint8Array([9, 9, 9, 255]) }
const file = new File([new Uint8Array([1])], 'shot.png', { type: 'image/png' })

function pasteEvent(items: Array<Partial<DataTransferItem>>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { items } })

  return event
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

let share: ReturnType<typeof createScreenShare>
let frames: ReturnType<typeof createRoundFrames>
let onPastedFrame: BrowserHost['onPastedFrame']
let unsubscribePastedFrame = (): void => {}

// 붙여넣기 listener는 페이지당 한 번 설치하고 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  share = createScreenShare()
  frames = createRoundFrames(share)
  onPastedFrame = frames.install()
})

beforeEach(() => {
  vi.mocked(decodeBrowserImage).mockResolvedValue(image)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  // 웹 앱 첫 화면처럼 붙여넣기 회차를 받을 화면이 있는 상태를 기본으로 둔다.
  unsubscribePastedFrame = onPastedFrame(() => undefined)
})

afterEach(() => {
  unsubscribePastedFrame()
  share.select('')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

it('페이지에 이미지를 붙여 넣으면 알리고 회차가 그 이미지를 프레임으로 읽는다', async () => {
  const pasted = vi.fn()
  const unsubscribe = onPastedFrame(pasted)
  await expect(frames.read()).rejects.toThrow('NO_PASTED_FRAME')

  document.dispatchEvent(pasteEvent([{ kind: 'string', type: 'text/plain' }]))
  expect(pasted).not.toHaveBeenCalled()

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  expect(pasted).toHaveBeenCalledOnce()
  await expect(frames.read()).resolves.toEqual(image)
  expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(file)
  unsubscribe()
})

it('붙여 넣은 이미지를 읽지 못하면 회차의 프레임 읽기가 거절한다', async () => {
  vi.mocked(decodeBrowserImage).mockRejectedValue(new Error('broken'))

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))

  await expect(frames.read()).rejects.toThrow('broken')
})

it('캡처 회차는 공유 화면을, 붙여넣기 회차는 붙여 넣은 이미지를 읽는다', async () => {
  const { getDisplayMedia } = stubScreenShare()
  stubVideoDecode()
  const sourceId = await share.request()

  expect(getDisplayMedia).toHaveBeenCalledExactlyOnceWith({
    video: { displaySurface: 'window' },
    audio: false
  })
  expect(share.select(sourceId!)).toEqual({ id: sourceId, name: 'Dungeon & Fighter' })
  await expect(frames.read()).resolves.toEqual(sharedImage)

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await expect(frames.read()).resolves.toEqual(image)
  await expect(frames.read()).resolves.toEqual(sharedImage)
})

it('붙여넣기 회차를 받을 화면이 없을 때 붙여 넣은 이미지는 들지 않아 캡처 회차가 공유 화면을 읽는다', async () => {
  stubScreenShare()
  stubVideoDecode()
  const sourceId = await share.request()
  share.select(sourceId!)
  unsubscribePastedFrame()

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))

  expect(decodeBrowserImage).not.toHaveBeenCalledWith(file)
  await expect(frames.read()).resolves.toEqual(sharedImage)
})

it('사용자가 공유를 멈추면 끝났다고 알리고, 앱이 끊은 공유와 거절한 요청은 알리지 않는다', async () => {
  const { track } = stubScreenShare()
  stubVideoDecode()
  const ended = vi.fn()
  const unsubscribe = share.onEnded(ended)
  const sourceId = await share.request()
  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await frames.read()

  track.dispatchEvent(new Event('ended'))

  expect(ended).toHaveBeenCalledOnce()
  expect(() => share.select(sourceId!)).toThrow('SCREEN_SHARE_ENDED')
  await expect(frames.read()).resolves.toEqual(image)

  const next = stubScreenShare()
  await share.request()
  share.select('')
  next.track.dispatchEvent(new Event('ended'))
  expect(next.track.stop).toHaveBeenCalledOnce()

  next.getDisplayMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
  await expect(share.request()).resolves.toBeNull()
  expect(ended).toHaveBeenCalledOnce()
  unsubscribe()
})
