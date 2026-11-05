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
import { WEB_CAPTURE_TEXTS } from '@dfragon/client-core/lib/capture-texts'
import { WEB_SCREEN_WATCH_TEXTS } from './web-capture-texts'

vi.mock('./browser-png', () => ({ decodeBrowserImage: vi.fn(), decodeBrowserPng: vi.fn() }))
vi.mock('./browser-raid-templates', () => ({ readRaidWindowTemplates: vi.fn() }))
vi.mock('./browser-town-template', () => ({ readTownIndicatorTemplate: vi.fn() }))

const API_BASE_URL = 'https://site.example.test/api'
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

function seats(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[aria-label*="번 자리"]')]
}

function nameOf(seat: HTMLTableRowElement): string | undefined {
  return seat.querySelector<HTMLInputElement>('input[aria-label$="번 캐릭터 이름"]')?.value
}

function globalMenu(): [string | null, string | null][] {
  return [...container.querySelectorAll('nav[aria-label="전역 메뉴"] a')].map((link) => [
    link.textContent,
    link.getAttribute('aria-current')
  ])
}

function homeLink(): HTMLAnchorElement {
  return [...container.querySelectorAll<HTMLAnchorElement>('main a')].find(
    (link) => link.textContent === '첫 화면으로'
  )!
}

async function waitForPath(pathname: string): Promise<void> {
  await vi.waitFor(() => expect(window.location.pathname).toBe(pathname))
}

let root: Root
let container: HTMLDivElement
let host: BrowserHost

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(API_BASE_URL)
})

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // 라우터는 화면을 옮길 때 창 스크롤을 처음으로 돌리는데 jsdom에는 scrollTo가 없다.
  vi.stubGlobal('scrollTo', vi.fn())
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

it('브라우저 host만으로 전역 바의 오늘 등급과 파티 표의 네 자리 행을 그린다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('header [role="img"]')?.getAttribute('aria-label')).toBe(
      '오늘 등급 85퍼센트, 언커먼'
    )
  )
  expect(container.querySelectorAll('tr[aria-label*="번 자리"]')).toHaveLength(4)
  expect(vi.mocked(fetch).mock.calls.map((args) => new Request(...args).url)).toContain(
    `${API_BASE_URL}/items/today-grade`
  )
})

it('첫 화면은 전역 바에 브랜드, 현재 항목인 파티, 공대 메뉴, 오늘 등급, 모드 전환 버튼을 두고 게임 바와 표는 화면 상자에 둔다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  const header = container.querySelector('header')!
  const brand = header.querySelector('a[aria-label="던삐삐 첫 화면"]')!
  const grade = header.querySelector('[role="img"]')!
  expect(brand.getAttribute('href')).toBe('/')
  expect(globalMenu()).toEqual([['파티, 공대', 'page']])
  expect(brand.compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['다크 모드로 바꾸기'])
  expect(grade.compareDocumentPosition(buttons[0]) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

  const main = container.querySelector('main')!
  const tabs = main.querySelector('[role="tablist"][aria-label="화면"]')!
  const boardTitle = main.querySelector('h1')!
  expect(boardTitle.textContent).toBe('파티')
  expect(tabs.compareDocumentPosition(boardTitle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(seats()).toHaveLength(4)
})

it('없는 주소는 전역 바 아래에 열려던 주소, 안내, 첫 화면 링크만 두고 링크를 누르면 파티 표로 간다', async () => {
  window.history.replaceState(null, '', '/guide?from=1')
  await act(async () => root.render(<WebApp host={host} />))

  const main = container.querySelector('main')!
  expect(main.querySelector('h1')?.textContent).toBe('없는 주소입니다.')
  expect(main.querySelector('p')?.textContent).toBe(`${window.location.host}/guide?from=1`)
  expect(homeLink().getAttribute('href')).toBe('/')
  expect(globalMenu()).toEqual([['파티, 공대', null]])
  expect(container.querySelector('[role="tablist"]')).toBeNull()
  expect(container.querySelector('button[aria-label^="화면 공유"]')).toBeNull()
  expect(seats()).toHaveLength(0)

  await act(async () => homeLink().click())

  await waitForPath('/')
  expect(seats()).toHaveLength(4)
  expect(globalMenu()).toEqual([['파티, 공대', 'page']])
})

it('없는 주소 화면에서는 Alt+방향키를 브라우저의 뒤로, 앞으로 가기에 넘긴다', async () => {
  window.history.replaceState(null, '', '/guide')
  await act(async () => root.render(<WebApp host={host} />))
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    altKey: true,
    bubbles: true,
    cancelable: true
  })

  homeLink().dispatchEvent(event)

  expect(event.defaultPrevented).toBe(false)
})

it('첫 화면에서 고친 이름과 맞바꾼 자리는 없는 주소 화면에 다녀와도 남는다', async () => {
  window.history.replaceState(null, '', '/guide')
  await act(async () => root.render(<WebApp host={host} />))
  await act(async () => homeLink().click())
  await waitForPath('/')
  const input = seats()[0].querySelector<HTMLInputElement>('input[aria-label$="번 캐릭터 이름"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      '남는이름'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    seats()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true })
    )
  )
  const before = seats().map(nameOf)
  expect(before).not.toEqual(['남는이름', '', '', ''])
  expect(before).toContain('남는이름')

  await act(async () => window.history.back())
  await waitForPath('/guide')
  expect(seats()).toHaveLength(0)
  await act(async () => window.history.forward())
  await waitForPath('/')

  await vi.waitFor(() => expect(seats().map(nameOf)).toEqual(before))
})

it('화면 공유는 없는 주소 화면에 다녀와도 연결된 채 남고, 다른 화면에서 공유를 멈추면 돌아왔을 때 연결 전이다', async () => {
  // jsdom에는 화면 공유와 video 재생이 없어 getDisplayMedia가 돌려주는 track과 stream만 흉내 낸다.
  const track = Object.assign(new EventTarget(), { label: 'Dungeon & Fighter', stop: vi.fn() })
  vi.stubGlobal('navigator', {
    mediaDevices: { getDisplayMedia: vi.fn(async () => ({ getVideoTracks: () => [track] })) }
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  window.history.replaceState(null, '', '/guide')
  await act(async () => root.render(<WebApp host={host} />))
  await act(async () => homeLink().click())
  await waitForPath('/')
  const chip = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="화면 공유"]')!
  await act(async () => chip().click())
  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결됨'))

  await act(async () => window.history.back())
  await waitForPath('/guide')
  await act(async () => window.history.forward())
  await waitForPath('/')
  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결됨'))

  await act(async () => window.history.back())
  await waitForPath('/guide')
  await act(async () => track.dispatchEvent(new Event('ended')))
  await act(async () => window.history.forward())
  await waitForPath('/')

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결'))
  expect(captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
})

it('다른 화면에서 붙여 넣은 이미지는 회차를 시작하지 않는다', async () => {
  window.history.replaceState(null, '', '/guide')
  await act(async () => root.render(<WebApp host={host} />))

  await act(async () => pasteImage())
  await act(async () => homeLink().click())
  await waitForPath('/')

  expect(decodeBrowserImage).not.toHaveBeenCalled()
  expect(captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
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

it('첫 화면 자리 행의 Alt+방향키는 브라우저에 넘기지 않고 이름 칸에서는 막지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  const seat = container.querySelector<HTMLElement>('tr[aria-label*="번 자리"]')!
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
  expect(container.querySelectorAll('tr[aria-label*="번 자리"]')).toHaveLength(12)

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
  expect(chip().textContent).toBe('화면 공유')
  expect(captureButton().disabled).toBe(true)

  await act(async () => chip().click())

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결됨'))
  expect(chip().textContent).toBe('게임 연결됨')
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
