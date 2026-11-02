// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import { installBrowserHost, type AutoRoundSignal, type BrowserHost } from './browser-host'
import { decodeBrowserImage } from './browser-png'
import { readRaidWindowTemplates } from './browser-raid-templates'
import { readTownIndicatorTemplate } from './browser-town-template'
import { WebApp } from './WebApp'
import { WEB_CAPTURE_TEXTS, WEB_SCREEN_WATCH_TEXTS } from './web-capture-texts'

vi.mock('./browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))
vi.mock('./browser-raid-templates', () => ({ readRaidWindowTemplates: vi.fn() }))
vi.mock('./browser-town-template', () => ({ readTownIndicatorTemplate: vi.fn() }))

const API_ORIGIN = 'https://api.example.test'
const pastedImage = { width: 1, height: 1, rgba: new Uint8Array([0, 0, 0, 255]) }

function pasteImage(): void {
  const event = new Event('paste', { bubbles: true })
  const file = new File([new Uint8Array([1])], 'shot.png', { type: 'image/png' })
  Object.defineProperty(event, 'clipboardData', {
    value: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] }
  })
  document.dispatchEvent(event)
}

// 공유 화면의 판정은 browser-host 테스트가 보고, 여기서는 host가 보내는 시작 신호를 직접 넣는다.
function hostWithAutoRound(): {
  watchedHost: BrowserHost
  sendAutoRound: (signal: AutoRoundSignal) => boolean
  setWatchedScreen: ReturnType<typeof vi.fn<BrowserHost['setWatchedScreen']>>
} {
  let listener: ((signal: AutoRoundSignal) => boolean) | null = null
  const setWatchedScreen = vi.fn<BrowserHost['setWatchedScreen']>()
  const watchedHost: BrowserHost = {
    ...host,
    setWatchedScreen,
    onAutoRound: (next) => {
      listener = next

      return () => {
        listener = null
      }
    }
  }

  return { watchedHost, sendAutoRound: (signal) => listener!(signal), setWatchedScreen }
}

function captureStatus(): string | null {
  return container.querySelector('[data-capture-announcer]')!.textContent
}

let root: Root
let container: HTMLDivElement
let host: BrowserHost

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(API_ORIGIN)
})

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(decodeBrowserImage).mockResolvedValue(pastedImage)
  vi.mocked(readTownIndicatorTemplate).mockResolvedValue(pastedImage)
  vi.mocked(readRaidWindowTemplates).mockRejectedValue(new Error('no templates'))
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () =>
      Response.json({ percent: 85, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
    )
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  useSearchModeStore.setState({ searchMode: 'party' })
})

it('브라우저 host만으로 상단 바와 파티 카드 네 장을 그린다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(container.textContent).toContain('85'))
  expect(container.querySelectorAll('article')).toHaveLength(4)
  expect(vi.mocked(fetch).mock.calls.map((args) => new Request(...args).url)).toContain(
    `${API_ORIGIN}/items/today-grade`
  )
})

it('Desktop과 달리 문서 전체의 드래그를 막지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  const event = new Event('dragstart', { bubbles: true, cancelable: true })

  document.body.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(false)
})

it('창을 고르기 전에는 붙여넣기 안내를 보이고, 이미지를 붙여 넣으면 지금 화면의 회차가 웹 문구로 진행된다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  expect(captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)

  await act(async () => pasteImage())

  // jsdom에는 Worker가 없어 OCR 준비 실패로 끝나므로 그 웹 문구까지 확인한다.
  await vi.waitFor(() => expect(captureStatus()).toBe(WEB_CAPTURE_TEXTS.ocrPrepareFailed))
  expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(expect.any(File))
})

it('앱 상자 안 카드의 Alt+방향키는 브라우저에 넘기지 않고 이름 칸에서는 막지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  const seat = container.querySelector('article')!
  const nameField = container.querySelector('input')!

  const onSeat = new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    altKey: true,
    bubbles: true,
    cancelable: true
  })
  seat.dispatchEvent(onSeat)
  const onNameField = new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    altKey: true,
    bubbles: true,
    cancelable: true
  })
  nameField.dispatchEvent(onNameField)

  expect(onSeat.defaultPrevented).toBe(true)
  expect(onNameField.defaultPrevented).toBe(false)
})

it('공대 화면에서 붙여 넣으면 공대 회차가 host의 공대 프레임 읽기로 시작된다', async () => {
  vi.mocked(readRaidWindowTemplates).mockRejectedValue(new Error('no templates'))
  useSearchModeStore.setState({ searchMode: 'raid' })
  const readRaidFrame = vi.spyOn(host.raid, 'readCaptureFrame')
  const readPartyFrame = vi.spyOn(host.party, 'readCaptureFrame')
  await act(async () => root.render(<WebApp host={host} />))
  expect(container.querySelectorAll('article')).toHaveLength(12)

  await act(async () => pasteImage())

  // 템플릿을 받지 못하면 공대 프레임 읽기가 거절돼 그 회차가 웹의 읽기 실패 문구로 끝난다.
  await vi.waitFor(() => expect(captureStatus()).toBe(WEB_CAPTURE_TEXTS.disconnected))
  expect(readRaidFrame).toHaveBeenCalledOnce()
  expect(readPartyFrame).not.toHaveBeenCalled()
  readRaidFrame.mockRestore()
  readPartyFrame.mockRestore()
})

it('게임 연결 칩으로 던파 창을 공유하면 캡처 버튼이 공유 화면을 읽고, 공유를 멈추면 연결 전으로 돌아간다', async () => {
  // jsdom에는 화면 공유와 video 재생이 없어 getDisplayMedia가 돌려주는 track과 stream만 흉내 낸다.
  const track = Object.assign(new EventTarget(), { label: 'Dungeon & Fighter', stop: vi.fn() })
  vi.stubGlobal('navigator', {
    mediaDevices: { getDisplayMedia: vi.fn(async () => ({ getVideoTracks: () => [track] })) }
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  await act(async () => root.render(<WebApp host={host} />))
  const chip = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="화면 공유"]')!
  const captureButton = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="파티 캡처"]')!
  expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결')
  expect(captureButton().disabled).toBe(true)

  await act(async () => chip().click())

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결됨'))
  expect(captureButton().disabled).toBe(false)

  await act(async () => captureButton().click())

  await vi.waitFor(() =>
    expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(expect.any(HTMLVideoElement))
  )

  await act(async () => track.dispatchEvent(new Event('ended')))

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결'))
  expect(captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
  expect(captureButton().disabled).toBe(true)
})

it('host의 시작 신호를 받으면 지금 화면의 회차를 시작하고 화면은 바꾸지 않으며, 다른 화면의 신호와 진행 중의 신호는 무시한다', async () => {
  const readPartyFrame = vi
    .spyOn(host.party, 'readCaptureFrame')
    .mockReturnValue(new Promise(() => undefined))
  const { watchedHost, sendAutoRound, setWatchedScreen } = hostWithAutoRound()
  await act(async () => root.render(<WebApp host={watchedHost} />))
  expect(setWatchedScreen).toHaveBeenLastCalledWith({ kind: 'party', roundRunning: false })

  let started = true
  await act(async () => {
    started = sendAutoRound({ kind: 'raid' })
  })
  expect(started).toBe(false)
  expect(readPartyFrame).not.toHaveBeenCalled()

  await act(async () => {
    started = sendAutoRound({ kind: 'party' })
  })
  expect(started).toBe(true)
  await vi.waitFor(() => expect(readPartyFrame).toHaveBeenCalledOnce())
  expect(useSearchModeStore.getState().searchMode).toBe('party')
  expect(setWatchedScreen).toHaveBeenLastCalledWith({ kind: 'party', roundRunning: true })

  await act(async () => {
    started = sendAutoRound({ kind: 'party' })
  })
  expect(started).toBe(false)
  expect(readPartyFrame).toHaveBeenCalledOnce()
  readPartyFrame.mockRestore()
})

it('공대 화면에서 공대 신호를 받으면 공대 회차가 host의 공대 프레임 읽기로 시작된다', async () => {
  useSearchModeStore.setState({ searchMode: 'raid' })
  const readRaidFrame = vi
    .spyOn(host.raid, 'readCaptureFrame')
    .mockReturnValue(new Promise(() => undefined))
  const readPartyFrame = vi.spyOn(host.party, 'readCaptureFrame')
  const { watchedHost, sendAutoRound, setWatchedScreen } = hostWithAutoRound()
  await act(async () => root.render(<WebApp host={watchedHost} />))
  expect(setWatchedScreen).toHaveBeenLastCalledWith({ kind: 'raid', roundRunning: false })

  await act(async () => {
    sendAutoRound({ kind: 'raid' })
  })

  await vi.waitFor(() => expect(readRaidFrame).toHaveBeenCalledOnce())
  expect(readPartyFrame).not.toHaveBeenCalled()
  expect(useSearchModeStore.getState().searchMode).toBe('raid')
  readRaidFrame.mockRestore()
  readPartyFrame.mockRestore()
})

it('던파 창을 연결한 동안 칩은 지금 화면의 마을 자동 인식을 안내한다', async () => {
  const track = Object.assign(new EventTarget(), { label: 'Dungeon & Fighter', stop: vi.fn() })
  vi.stubGlobal('navigator', {
    mediaDevices: { getDisplayMedia: vi.fn(async () => ({ getVideoTracks: () => [track] })) }
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  await act(async () => root.render(<WebApp host={host} />))
  const chip = container.querySelector<HTMLButtonElement>('button[aria-label^="화면 공유"]')!

  await act(async () => chip.click())

  await vi.waitFor(() => expect(captureStatus()).toBe(WEB_SCREEN_WATCH_TEXTS.party.waiting))
  await act(async () => useSearchModeStore.setState({ searchMode: 'raid' }))
  expect(captureStatus()).toBe(WEB_SCREEN_WATCH_TEXTS.raid.waiting)
  await act(async () => host.party.selectCaptureSource(''))
})
