// @vitest-environment jsdom
import type { DNFParticipantFrame } from '@dfragon/lib'
import { afterEach, beforeAll, beforeEach, expect, it, vi, type Mock } from 'vitest'
import type { CharacterImage } from '@dfragon/client-core/preload/common/types/character'
import type { RaidWindowTemplates } from '@dfragon/client-core/shared/raid/raid-window'
import { installBrowserHost } from '..'
import type { BrowserHost } from '../client-host'
import { decodeBrowserImage } from '../browser-png'
import { readRaidWindowTemplates } from '../screen-watch/browser-raid-templates'
import { readTownIndicatorTemplate } from '../screen-watch/browser-town-template'

vi.mock('../browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))
vi.mock('../screen-watch/browser-town-template', () => ({ readTownIndicatorTemplate: vi.fn() }))
vi.mock('../screen-watch/browser-raid-templates', () => ({ readRaidWindowTemplates: vi.fn() }))

const API_ORIGIN = 'https://api.example.test'
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

const FRAME_SIZE = 32
const townTemplate: DNFParticipantFrame = solid(0)
const raidTemplates = {} as RaidWindowTemplates

function solid(gray: number): CharacterImage {
  const rgba = new Uint8Array(FRAME_SIZE * FRAME_SIZE * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba.set([gray, gray, gray, 255], index)
  }

  return { width: FRAME_SIZE, height: FRAME_SIZE, rgba }
}

let host: BrowserHost
let unsubscribePastedFrame = (): void => {}

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(
    API_ORIGIN,
    'https://site.example.test/skilltab/skilltab.v3.json',
    'https://site.example.test/skilltab/oath.v2.json'
  )
})

beforeEach(() => {
  vi.mocked(decodeBrowserImage).mockResolvedValue(image)
  vi.mocked(readTownIndicatorTemplate).mockResolvedValue(townTemplate)
  vi.mocked(readRaidWindowTemplates).mockResolvedValue(raidTemplates)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  // 웹 앱 첫 화면처럼 붙여넣기 회차를 받을 화면이 있는 상태를 기본으로 둔다.
  unsubscribePastedFrame = host.onPastedFrame(() => undefined)
})

afterEach(async () => {
  unsubscribePastedFrame()
  await host.party.selectCaptureSource('')
  host.setWatchedScreen({ kind: 'party', roundRunning: false })
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

it('페이지에 이미지를 붙여 넣으면 알리고 readCaptureFrame이 그 이미지를 프레임으로 돌려준다', async () => {
  const pasted = vi.fn()
  const unsubscribe = host.onPastedFrame(pasted)
  await expect(host.party.readCaptureFrame()).rejects.toThrow('NO_PASTED_FRAME')

  document.dispatchEvent(pasteEvent([{ kind: 'string', type: 'text/plain' }]))
  expect(pasted).not.toHaveBeenCalled()

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  expect(pasted).toHaveBeenCalledOnce()
  await expect(host.party.readCaptureFrame()).resolves.toEqual(image)
  expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(file)
  unsubscribe()
})

it('붙여 넣은 이미지를 읽지 못하면 readCaptureFrame이 거절한다', async () => {
  vi.mocked(decodeBrowserImage).mockRejectedValue(new Error('broken'))

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))

  await expect(host.party.readCaptureFrame()).rejects.toThrow('broken')
})

it('캡처 회차는 공유 화면을, 붙여넣기 회차는 붙여 넣은 이미지를 읽는다', async () => {
  const { getDisplayMedia } = stubScreenShare()
  stubVideoDecode()
  const sourceId = await host.requestScreenShare()

  expect(getDisplayMedia).toHaveBeenCalledExactlyOnceWith({
    video: { displaySurface: 'window' },
    audio: false
  })
  await expect(host.party.selectCaptureSource(sourceId!)).resolves.toEqual({
    id: sourceId,
    name: 'Dungeon & Fighter'
  })
  await expect(host.party.readCaptureFrame()).resolves.toEqual(sharedImage)

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await expect(host.party.readCaptureFrame()).resolves.toEqual(image)
  await expect(host.party.readCaptureFrame()).resolves.toEqual(sharedImage)
})

it('붙여넣기 회차를 받을 화면이 없을 때 붙여 넣은 이미지는 들지 않아 캡처 회차가 공유 화면을 읽는다', async () => {
  stubScreenShare()
  stubVideoDecode()
  const sourceId = await host.requestScreenShare()
  await host.party.selectCaptureSource(sourceId!)
  unsubscribePastedFrame()

  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))

  expect(decodeBrowserImage).not.toHaveBeenCalledWith(file)
  await expect(host.party.readCaptureFrame()).resolves.toEqual(sharedImage)
})

it('사용자가 공유를 멈추면 끝났다고 알리고, 앱이 끊은 공유와 거절한 요청은 알리지 않는다', async () => {
  const { track } = stubScreenShare()
  stubVideoDecode()
  const ended = vi.fn()
  const unsubscribe = host.onScreenShareEnded(ended)
  const sourceId = await host.requestScreenShare()
  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await host.party.readCaptureFrame()

  track.dispatchEvent(new Event('ended'))

  expect(ended).toHaveBeenCalledOnce()
  await expect(host.party.selectCaptureSource(sourceId!)).rejects.toThrow('SCREEN_SHARE_ENDED')
  await expect(host.party.readCaptureFrame()).resolves.toEqual(image)

  const next = stubScreenShare()
  await host.requestScreenShare()
  await host.party.selectCaptureSource('')
  next.track.dispatchEvent(new Event('ended'))
  expect(next.track.stop).toHaveBeenCalledOnce()

  next.getDisplayMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
  await expect(host.requestScreenShare()).resolves.toBeNull()
  expect(ended).toHaveBeenCalledOnce()
  unsubscribe()
})
