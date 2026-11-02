// @vitest-environment jsdom
import {
  detectDNFTownIndicator,
  detectPartyFrameGeometry,
  PartyFrameGeometryError,
  type DNFParticipantFrame,
  type DNFRectangle,
  type PartyFrameSlot
} from '@dfragon/lib'
import { afterEach, beforeAll, beforeEach, expect, it, vi, type Mock } from 'vitest'
import type { CharacterImage } from '@dfragon/client-core/preload/common/types/character'
import {
  cropRaidWindowNicknames,
  readRaidWindowValues,
  type RaidWindowTemplates
} from '@dfragon/client-core/shared/raid/raid-window'
import { installBrowserHost, type AutoRoundSignal, type BrowserHost } from './browser-host'
import { decodeBrowserImage } from './browser-png'
import { readRaidWindowTemplates } from './browser-raid-templates'
import { readTownIndicatorTemplate } from './browser-town-template'

vi.mock('./browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))
vi.mock('./browser-town-template', () => ({ readTownIndicatorTemplate: vi.fn() }))
vi.mock('./browser-raid-templates', () => ({ readRaidWindowTemplates: vi.fn() }))
// 검출기는 프레임마다 정한 장면으로 답하게 바꾸고, 같은 구성 판정은 screen-watch를 그대로 쓴다.
vi.mock('@dfragon/lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dfragon/lib')>()),
  detectDNFTownIndicator: vi.fn(),
  detectPartyFrameGeometry: vi.fn()
}))
vi.mock('@dfragon/client-core/shared/raid/raid-window', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dfragon/client-core/shared/raid/raid-window')>()),
  cropRaidWindowNicknames: vi.fn(),
  readRaidWindowValues: vi.fn()
}))

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

// 합성 장면이다. party, raid 값은 그 화면의 이름이고 null이면 그 화면의 창이 없다. 파티 이름은 partySlot 슬롯
// 하나에만 보인다.
type Scene = Readonly<{
  town: boolean
  party: number | null
  partySlot: PartyFrameSlot
  raid: number | null
}>

const FRAME_SIZE = 32
const scenes = new WeakMap<object, Scene>()
const region: DNFRectangle = { x: 0, y: 0, width: FRAME_SIZE, height: FRAME_SIZE }
const townTemplate: DNFParticipantFrame = solid(0)
const raidTemplates = {} as RaidWindowTemplates

function solid(gray: number): CharacterImage {
  const rgba = new Uint8Array(FRAME_SIZE * FRAME_SIZE * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba.set([gray, gray, gray, 255], index)
  }

  return { width: FRAME_SIZE, height: FRAME_SIZE, rgba }
}

// 이름 값의 10분의 1만큼 왼쪽 열을 흰 글자로 칠한다. 쓰는 값끼리 2열(64픽셀) 이상 달라 다른 구성으로 갈린다.
function nameImage(name: number): CharacterImage {
  const frame = solid(0)
  for (let y = 0; y < FRAME_SIZE; y += 1) {
    frame.rgba.fill(255, y * FRAME_SIZE * 4, (y * FRAME_SIZE + name / 10) * 4)
  }

  return frame
}

// 파티 이름 영역은 프레임 전체이고, 프레임의 픽셀이 곧 파티 이름 crop이다.
function gameFrame(scene: Partial<Scene>): CharacterImage {
  const resolved: Scene = { town: true, party: null, partySlot: 2, raid: null, ...scene }
  const frame = nameImage(resolved.party ?? 0)
  scenes.set(frame, resolved)

  return frame
}

function stubDetectors(): void {
  vi.mocked(detectDNFTownIndicator).mockImplementation((frame) =>
    scenes.get(frame)?.town === true
      ? { status: 'found', scale: 1, matchScore: 1, region }
      : { status: 'not-found' }
  )
  vi.mocked(detectPartyFrameGeometry).mockImplementation((frame) => {
    const scene = scenes.get(frame)
    if (scene?.party == null) {
      throw new PartyFrameGeometryError('no-anchor')
    }

    return { scale: 1, slots: [{ slot: scene.partySlot, ...region, coverage: region }] }
  })
  vi.mocked(cropRaidWindowNicknames).mockImplementation((frame) => {
    const name = scenes.get(frame)?.raid
    if (name == null) {
      return { status: 'not-found' }
    }
    const row = {
      row: 1 as const,
      occupied: true,
      nickname: region,
      partyRegion: region,
      equipmentScoreRegion: region,
      jobRegion: region,
      nicknameCrop: nameImage(name)
    }

    return {
      status: 'found',
      scale: 1,
      matchScore: 1,
      window: region,
      valueHeadingRegion: region,
      rows: [row]
    }
  })
  vi.mocked(readRaidWindowValues).mockReturnValue({ valueColumn: 'unknown', valueTexts: [null] })
}

// 공유 화면의 video를 읽으면 지금 보이는 게임 프레임을 돌려준다.
function showGame(frame: CharacterImage): void {
  vi.mocked(decodeBrowserImage).mockImplementation(async (source) =>
    source instanceof HTMLVideoElement ? frame : image
  )
}

function videoReads(): number {
  return vi
    .mocked(decodeBrowserImage)
    .mock.calls.filter(([source]) => source instanceof HTMLVideoElement).length
}

async function passTick(): Promise<void> {
  await vi.advanceTimersToNextTimerAsync()
}

async function connectWatchedShare(): Promise<{
  track: EventTarget & { stop: () => void }
  getDisplayMedia: Mock
  signals: Mock<(signal: AutoRoundSignal) => boolean>
}> {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  stubDetectors()
  const share = stubScreenShare()
  const signals = vi.fn<(signal: AutoRoundSignal) => boolean>(() => true)
  unsubscribeAutoRound = host.onAutoRound(signals)
  await host.requestScreenShare()

  return { ...share, signals }
}

let host: BrowserHost
let unsubscribeAutoRound = (): void => {}

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(API_ORIGIN)
})

beforeEach(() => {
  vi.mocked(decodeBrowserImage).mockResolvedValue(image)
  vi.mocked(readTownIndicatorTemplate).mockResolvedValue(townTemplate)
  vi.mocked(readRaidWindowTemplates).mockResolvedValue(raidTemplates)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

afterEach(async () => {
  await host.party.selectCaptureSource('')
  unsubscribeAutoRound()
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

it('페이지의 Alt+W, Alt+A를 페이지 단축키로 알리고 다른 조합은 브라우저에 넘긴다', () => {
  const received = vi.fn()
  const unsubscribe = host.onShortcut(received)

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

it('캡처 회차는 공유 화면을, 붙여넣기 회차는 붙여 넣은 이미지를 읽는다', async () => {
  const { getDisplayMedia } = stubScreenShare()
  stubVideoDecode()
  const received = vi.fn()
  const unsubscribe = host.onShortcut(received)

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

it('공유한 동안 틱마다 지금 프레임을 판정하고, 마을에서 새 파티 구성이 2번 연속 보일 때만 시작 신호를 보낸다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))

  await passTick()
  expect(videoReads()).toBe(1)
  expect(signals).not.toHaveBeenCalled()

  await passTick()
  expect(videoReads()).toBe(2)
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('신호로 시작한 회차는 판정에 쓴 프레임을 읽고, 그 구성이 기준이 되어 같은 구성에는 다시 신호를 보내지 않는다', async () => {
  const { signals } = await connectWatchedShare()
  const judged = gameFrame({ party: 40 })
  showGame(judged)
  await passTick()
  await passTick()
  showGame(gameFrame({ party: 90 }))

  await expect(host.party.readCaptureFrame()).resolves.toEqual(judged)
  const sameNames = gameFrame({ party: 40 })
  showGame(sameNames)
  await passTick()
  await passTick()
  expect(signals).toHaveBeenCalledOnce()

  await expect(host.party.readCaptureFrame()).resolves.toEqual(sameNames)
})

it('entry가 신호로 회차를 시작하지 않으면 든 프레임을 놓아 다음 캡처 회차가 공유 화면을 읽는다', async () => {
  const { signals } = await connectWatchedShare()
  signals.mockReturnValue(false)
  showGame(gameFrame({ party: 40 }))
  await passTick()
  await passTick()
  const live = gameFrame({ party: 90 })
  showGame(live)

  expect(signals).toHaveBeenCalledOnce()
  await expect(host.party.readCaptureFrame()).resolves.toEqual(live)
})

it('마을이 아니거나 지금 화면의 창이 없으면 신호가 없고, 지금 화면이 아닌 쪽 검출기는 부르지 않는다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ town: false, party: 40, raid: 40 }))
  await passTick()
  await passTick()
  expect(detectPartyFrameGeometry).not.toHaveBeenCalled()

  showGame(gameFrame({ party: 40 }))
  host.setWatchedScreen({ kind: 'raid', roundRunning: false })
  await passTick()
  await passTick()
  expect(detectPartyFrameGeometry).not.toHaveBeenCalled()
  expect(cropRaidWindowNicknames).toHaveBeenCalledTimes(2)
  expect(signals).not.toHaveBeenCalled()

  showGame(gameFrame({ party: 40, raid: 70 }))
  host.setWatchedScreen({ kind: 'party', roundRunning: false })
  await passTick()
  expect(cropRaidWindowNicknames).toHaveBeenCalledTimes(2)
  host.setWatchedScreen({ kind: 'raid', roundRunning: false })
  await passTick()
  expect(signals).not.toHaveBeenCalled()
  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'raid' })
})

it('캡처 버튼, 붙여넣기 회차가 읽은 프레임이 그 화면의 기준이 된다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40, raid: 70 }))
  await host.party.readCaptureFrame()
  await host.raid.readCaptureFrame()
  await passTick()
  await passTick()
  host.setWatchedScreen({ kind: 'raid', roundRunning: false })
  await passTick()
  await passTick()
  expect(signals).not.toHaveBeenCalled()

  const pasted = gameFrame({ raid: 120 })
  vi.mocked(decodeBrowserImage).mockResolvedValueOnce(pasted)
  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await host.raid.readCaptureFrame()
  showGame(gameFrame({ raid: 120 }))
  await passTick()
  await passTick()
  expect(signals).not.toHaveBeenCalled()

  showGame(gameFrame({ raid: 70 }))
  await passTick()
  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'raid' })
})

it('회차가 이름 crop을 못 만든 프레임을 읽으면 빈 기준이 되어, 앞 기준과 같은 구성도 다시 보이면 새 구성으로 본다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  await host.party.readCaptureFrame()
  showGame(gameFrame({ party: null }))
  await host.party.readCaptureFrame()

  showGame(gameFrame({ party: 40 }))
  await passTick()
  await passTick()

  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('회차가 진행 중이면 프레임을 읽지 않고, 읽는 동안 회차가 시작돼도 그 결과로 신호를 보내지 않는다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  host.setWatchedScreen({ kind: 'party', roundRunning: true })
  await passTick()
  await passTick()
  expect(videoReads()).toBe(0)

  host.setWatchedScreen({ kind: 'party', roundRunning: false })
  await passTick()
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  await passTick()
  host.setWatchedScreen({ kind: 'party', roundRunning: true })
  const detections = vi.mocked(detectDNFTownIndicator).mock.calls.length
  resolve(gameFrame({ party: 40 }))
  await passTick()

  expect(signals).not.toHaveBeenCalled()
  expect(detectDNFTownIndicator).toHaveBeenCalledTimes(detections)
})

it('프레임을 읽는 동안 회차가 시작해 프레임을 읽고 끝나면, 회차 전에 읽기 시작한 틱의 결과를 버린다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 90 }))
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  await passTick()

  host.setWatchedScreen({ kind: 'party', roundRunning: true })
  await host.party.readCaptureFrame()
  host.setWatchedScreen({ kind: 'party', roundRunning: false })
  resolve(gameFrame({ party: 40 }))
  showGame(gameFrame({ party: 40 }))
  await passTick()
  expect(signals).not.toHaveBeenCalled()

  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('앞 틱이 아직 프레임을 읽고 있으면 다음 틱은 프레임을 읽지 않고 건너뛴다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  await passTick()

  await passTick()
  expect(videoReads()).toBe(1)

  resolve(gameFrame({ party: 40 }))
  await passTick()
  expect(videoReads()).toBe(2)
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('웹의 화면이 바뀌면 후보를 버리고, 프레임을 읽는 동안 화면이 바뀐 틱의 결과도 버린다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  await passTick()
  host.setWatchedScreen({ kind: 'raid', roundRunning: false })
  host.setWatchedScreen({ kind: 'party', roundRunning: false })
  await passTick()
  expect(signals).not.toHaveBeenCalled()
  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })

  showGame(gameFrame({ party: 90 }))
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  await passTick()
  host.setWatchedScreen({ kind: 'raid', roundRunning: false })
  host.setWatchedScreen({ kind: 'party', roundRunning: false })
  resolve(gameFrame({ party: 90 }))
  await passTick()
  expect(signals).toHaveBeenCalledOnce()
  await passTick()
  expect(signals).toHaveBeenCalledTimes(2)
})

it('같은 이름 crop이 다른 파티 슬롯으로 옮겨 가면 다른 구성으로 보고 회차 신호를 보낸다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40, partySlot: 2 }))
  await host.party.readCaptureFrame()

  showGame(gameFrame({ party: 40, partySlot: 3 }))
  await passTick()
  await passTick()

  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('entry가 거절한 신호는 대기 중인 붙여넣기 프레임을 지우지 않는다', async () => {
  const { signals } = await connectWatchedShare()
  signals.mockReturnValue(false)
  showGame(gameFrame({ party: 40 }))
  await passTick()
  document.dispatchEvent(pasteEvent([{ kind: 'file', type: 'image/png', getAsFile: () => file }]))
  await passTick()
  expect(signals).toHaveBeenCalledOnce()

  await expect(host.party.readCaptureFrame()).resolves.toEqual(image)
})

it('회차가 프레임을 읽는 동안 공유가 바뀌면 그 프레임을 새 공유의 기준으로 기록하지 않는다', async () => {
  const { signals } = await connectWatchedShare()
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  const read = host.party.readCaptureFrame()

  stubScreenShare()
  await host.requestScreenShare()
  resolve(gameFrame({ party: 40 }))
  await read
  showGame(gameFrame({ party: 40 }))
  await passTick()
  await passTick()

  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('검출기가 예외를 던진 틱은 창을 찾지 못한 틱으로 보아 2번 연속을 처음부터 다시 센다', async () => {
  const { signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  await passTick()
  vi.mocked(detectDNFTownIndicator).mockImplementationOnce(() => {
    throw new RangeError('DNF town detection requires bounded RGBA frames and a 16x16 template.')
  })
  await passTick()
  await passTick()
  expect(signals).not.toHaveBeenCalled()

  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('공유를 바꾸면 기준을 비우고, 판정 중에 바뀐 공유의 결과는 버린다', async () => {
  const { track, signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  await host.party.readCaptureFrame()
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  await passTick()

  const replacedVideo = vi.mocked(decodeBrowserImage).mock.lastCall![0]
  const replacedReads = (): number =>
    vi.mocked(decodeBrowserImage).mock.calls.filter(([source]) => source === replacedVideo).length
  const readsBeforeReplace = replacedReads()
  stubScreenShare()
  await host.requestScreenShare()
  resolve(gameFrame({ party: 40 }))
  await passTick()
  expect(track.stop).toHaveBeenCalledOnce()
  expect(signals).not.toHaveBeenCalled()
  expect(replacedReads()).toBe(readsBeforeReplace)

  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('판정 중에 사용자가 공유를 멈추면 그 프레임의 결과를 버려 다시 연결한 공유의 판정에 섞지 않는다', async () => {
  const { track, signals } = await connectWatchedShare()
  showGame(gameFrame({ party: 40 }))
  const { promise, resolve } = Promise.withResolvers<CharacterImage>()
  vi.mocked(decodeBrowserImage).mockReturnValueOnce(promise)
  await passTick()

  track.dispatchEvent(new Event('ended'))
  stubScreenShare()
  await host.requestScreenShare()
  resolve(gameFrame({ party: 40 }))
  await passTick()
  expect(signals).not.toHaveBeenCalled()

  await passTick()
  expect(signals).toHaveBeenCalledExactlyOnceWith({ kind: 'party' })
})

it('사용자가 공유를 멈추면 틱을 멈추고 회차용으로 든 프레임을 놓는다', async () => {
  const { track, signals } = await connectWatchedShare()
  const judged = gameFrame({ party: 40 })
  showGame(judged)
  await passTick()
  await passTick()
  expect(signals).toHaveBeenCalledOnce()

  track.dispatchEvent(new Event('ended'))
  const reads = videoReads()
  await passTick()

  expect(videoReads()).toBe(reads)
  const next = await host.party.readCaptureFrame().catch(() => null)
  expect(next).not.toEqual(judged)
})
