// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { useFavoriteCharacterStore } from '../../hooks/useFavoriteCharacterStore'
import { useMyAdventureStore } from '../../hooks/useMyAdventureStore'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import { installBrowserHost, type AutoRoundSignal, type BrowserHost } from './browser-host'
import { decodeBrowserImage } from './browser-png'
import { readRaidWindowTemplates } from './browser-raid-templates'
import { readTownIndicatorTemplate } from './browser-town-template'
import { WebApp } from './WebApp'
import { CHARACTER_SERVER_NAMES } from '@dfragon/client-core/preload/common/search/character-summary'
import type { CharacterCandidate } from '@dfragon/client-core/preload/common/types/character'
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
  host = installBrowserHost(
    API_BASE_URL,
    'https://site.example.test/skilltab/skilltab.json',
    'https://site.example.test/skilltab/oath.json'
  )
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
  localStorage.clear()
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
  useMyAdventureStore.setState({ adventureName: null })
  localStorage.clear()
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

it('첫 화면은 전역 바에 브랜드, 현재 항목인 파티, 공대 메뉴, 검색창, 오늘 등급, 모드 전환 버튼을 두고 게임 바와 표는 화면 상자에 둔다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  const header = container.querySelector('header')!
  const brand = header.querySelector('a[aria-label="던삐삐 첫 화면"]')!
  const grade = header.querySelector('[role="img"]')!
  expect(brand.getAttribute('href')).toBe('/')
  expect(globalMenu()).toEqual([
    ['파티, 공대', 'page'],
    ['내 모험단', null],
    ['즐겨찾기', null]
  ])
  expect(brand.compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    '검색 대상',
    '검색',
    '다크 모드로 바꾸기'
  ])
  expect(grade.compareDocumentPosition(buttons[2]) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

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
  expect(globalMenu()).toEqual([
    ['파티, 공대', null],
    ['내 모험단', null],
    ['즐겨찾기', null]
  ])
  expect(container.querySelector('[role="tablist"]')).toBeNull()
  expect(container.querySelector('button[aria-label^="화면 공유"]')).toBeNull()
  expect(seats()).toHaveLength(0)

  await act(async () => homeLink().click())

  await waitForPath('/')
  expect(seats()).toHaveLength(4)
  expect(globalMenu()).toEqual([
    ['파티, 공대', 'page'],
    ['내 모험단', null],
    ['즐겨찾기', null]
  ])
})

const DETAIL_PATH = '/c/prey/buffer-1'

function stubDetailFetch(): ReturnType<typeof vi.fn<typeof fetch>> {
  const detail = vi.fn<typeof fetch>(async (...args) => {
    if (new Request(...args).url !== `${API_BASE_URL}/characters/prey/buffer-1`) {
      return Response.json({
        percent: 85,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString()
      })
    }

    return Response.json({
      character: { serverId: 'prey', characterId: 'buffer-1', characterName: '하늘', fame: 126965 },
      card: { role: 'buffer', score: null }
    })
  })
  vi.stubGlobal('fetch', detail)

  return detail
}

function detailRequests(detail: ReturnType<typeof vi.fn<typeof fetch>>): number {
  return detail.mock.calls.filter((args) => new Request(...args).url.includes('/characters/prey/'))
    .length
}

function selectedTab(): string | null | undefined {
  return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent
}

it('캐릭터 주소를 직접 열면 주소의 tab으로 요약과 탭을 그리고, 탭을 바꾸면 다시 조회하지 않고 지금 기록의 tab만 바꾼다', async () => {
  const detail = stubDetailFetch()
  window.history.replaceState(null, '', `${DETAIL_PATH}?tab=skill`)
  const historyLength = window.history.length
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(container.querySelector('main h1')?.textContent).toBe('하늘'))
  expect(selectedTab()).toBe('스킬')
  expect(globalMenu()).toEqual([
    ['파티, 공대', null],
    ['내 모험단', null],
    ['즐겨찾기', null]
  ])

  const statusTab = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (tab) => tab.textContent === '스탯'
  )!
  await act(async () => statusTab.click())

  await vi.waitFor(() => expect(window.location.search).toBe('?tab=status'))
  expect(selectedTab()).toBe('스탯')
  expect(window.history.length).toBe(historyLength)
  expect(detailRequests(detail)).toBe(1)
})

it('한글 모험단 이름의 주소를 직접 열면 그 모험단의 캐릭터 목록을 조회해 그린다', async () => {
  const requested = vi.fn<typeof fetch>(async () =>
    Response.json({
      adventureName: '동네커피',
      characters: [
        {
          serverId: 'cain',
          characterId: 'coffee-1',
          characterName: '커피',
          adventureName: '동네커피',
          level: 115,
          jobId: null,
          jobGrowId: null,
          jobName: null,
          jobGrowName: null,
          fame: 1000,
          guildId: null,
          guildName: null
        }
      ]
    })
  )
  vi.stubGlobal('fetch', requested)
  window.history.replaceState(null, '', `/adventures/${encodeURIComponent('동네커피')}`)
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('main tbody a')?.getAttribute('href')).toBe('/c/cain/coffee-1')
  )
  expect(container.querySelector('main h1')?.textContent).toBe('동네커피')
  expect(requested.mock.calls.map((args) => new Request(...args).url)).toContain(
    `${API_BASE_URL}/adventures/${encodeURIComponent('동네커피')}/characters`
  )
})

it('캐릭터 주소의 tab이 모르는 값이면 장비 탭을 연다', async () => {
  stubDetailFetch()
  window.history.replaceState(null, '', `${DETAIL_PATH}?tab=unknown`)
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(selectedTab()).toBe('장비'))
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

function candidateRow(
  characterName: string,
  serverId: 'cain' | 'prey',
  characterId: string,
  fame: number | null
): CharacterCandidate {
  const serverName = CHARACTER_SERVER_NAMES[serverId]

  return {
    serverId,
    characterId,
    characterName,
    serverName,
    fame,
    adventureName: null,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1`,
    jobName: '프리스트(남)',
    jobGrowName: '眞 크루세이더'
  }
}

function stubSearchFetch(
  rows: readonly CharacterCandidate[]
): ReturnType<typeof vi.fn<typeof globalThis.fetch>> {
  const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
    const url = new URL(new Request(...args).url)
    if (url.pathname === '/api/characters') {
      return Response.json({ rows })
    }

    return Response.json({
      percent: 85,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    })
  })
  vi.stubGlobal('fetch', fetch)

  return fetch
}

function searchRequests(fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>): URL[] {
  return fetch.mock.calls
    .map((args) => new URL(new Request(...args).url))
    .filter((url) => url.pathname === '/api/characters')
}

function searchBox(): HTMLFormElement {
  return container.querySelector<HTMLFormElement>('header form[role="search"]')!
}

async function chooseScope(label: string): Promise<void> {
  await act(async () =>
    searchBox().querySelector<HTMLButtonElement>('button[aria-label="검색 대상"]')!.click()
  )
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === label
  )!
  await act(async () => option.click())
}

async function searchName(name: string): Promise<void> {
  const box = searchBox()
  const input = box.querySelector<HTMLInputElement>('input[type="search"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => box.requestSubmit())
}

function searchResultRows(): [string | null, string | null][] {
  return [...container.querySelectorAll('main section tbody tr')].map((row) => [
    row.querySelector('a')?.getAttribute('href') ?? null,
    row.textContent
  ])
}

it('전역 검색창은 오늘 등급 왼쪽에 검색 대상, 이름 칸, 검색 버튼 순으로 두고 대상 기본값은 전체다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  const header = container.querySelector('header')!
  const box = searchBox()
  const grade = header.querySelector('[role="img"]')!
  expect(box.compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(
    [...box.querySelectorAll('button, input[type="search"]')].map((control) =>
      control.getAttribute('aria-label')
    )
  ).toEqual(['검색 대상', '캐릭터 이름', '검색'])
  expect(box.querySelector('button[aria-label="검색 대상"]')?.textContent).toBe('전체')
})

it('검색 대상 목록은 전체, 서버, 모험단 순이고 모험단을 고르면 이름 칸이 모험단 이름으로 바뀐다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  await act(async () =>
    searchBox().querySelector<HTMLButtonElement>('button[aria-label="검색 대상"]')!.click()
  )

  const options = [...document.querySelectorAll('[role="option"]')].map((item) => item.textContent)
  expect(options[0]).toBe('전체')
  expect(options.at(-1)).toBe('모험단')
  expect(options.slice(1, -1).toSorted()).toEqual(Object.values(CHARACTER_SERVER_NAMES).toSorted())
  await act(async () => document.querySelector<HTMLElement>('[role="option"]:last-child')!.click())

  const input = searchBox().querySelector<HTMLInputElement>('input[type="search"]')!
  expect(input.getAttribute('aria-label')).toBe('모험단 이름')
  expect(input.getAttribute('placeholder')).toBe('모험단 이름')
})

it('캐릭터 검색을 제출하면 결과가 한 명이어도 검색 화면으로 가서 목록을 보이고, 고른 캐릭터의 상세로 가며 뒤로 가면 목록으로 돌아온다', async () => {
  const fetch = stubSearchFetch([candidateRow('한명', 'cain', 'only-1', 50000)])
  await act(async () => root.render(<WebApp host={host} />))

  await searchName(' 한명 ')

  await waitForPath('/search')
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    characterName: '한명',
    serverId: 'all'
  })
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([['/c/cain/only-1', '카인한명眞 크루세이더50,000']])
  )
  expect(searchRequests(fetch).map((url) => Object.fromEntries(url.searchParams))).toEqual([
    { characterName: '한명', serverId: 'all', limit: '200' }
  ])

  await act(async () => container.querySelector<HTMLAnchorElement>('main tbody a')!.click())

  await waitForPath('/c/cain/only-1')
  await act(async () => window.history.back())
  await waitForPath('/search')
  await vi.waitFor(() => expect(searchResultRows()).toHaveLength(1))
})

it('서버를 고른 캐릭터 검색은 그 서버로 찾고 명성 순 응답을 그 순서대로 보인다', async () => {
  const fetch = stubSearchFetch([
    candidateRow('카인검색1', 'cain', 'server-1', 90000),
    candidateRow('카인검색', 'cain', 'server-2', null)
  ])
  await act(async () => root.render(<WebApp host={host} />))
  await chooseScope('카인')

  await searchName('카인검색')

  await waitForPath('/search')
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([
      ['/c/cain/server-1', '카인카인검색1眞 크루세이더90,000'],
      ['/c/cain/server-2', '카인카인검색眞 크루세이더-']
    ])
  )
  expect(container.querySelector('main h1')?.textContent).toBe('캐릭터 검색')
  expect(searchRequests(fetch).map((url) => url.searchParams.get('serverId'))).toEqual(['cain'])
})

it('캐릭터 이름 한 글자를 제출하면 검색 화면으로 가서 그 이름으로 찾는다', async () => {
  const fetch = stubSearchFetch([candidateRow('가', 'cain', 'single-1', 1000)])
  await act(async () => root.render(<WebApp host={host} />))

  await searchName('가')

  await waitForPath('/search')
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([['/c/cain/single-1', '카인가眞 크루세이더1,000']])
  )
  expect(searchRequests(fetch).map((url) => url.searchParams.get('characterName'))).toEqual(['가'])
})

it('검색 결과가 없으면 찾지 못했다는 목록 제목 한 줄만 보인다', async () => {
  stubSearchFetch([])
  window.history.replaceState(null, '', '/search?characterName=없는이름&serverId=all')
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('main section')?.textContent).toBe('캐릭터를 찾지 못했습니다.')
  )
  expect(container.querySelector('main table')).toBeNull()
})

it('주소의 이름이 열세 글자면 검색 화면은 요청하지 않는다', async () => {
  const fetch = stubSearchFetch([])
  window.history.replaceState(
    null,
    '',
    '/search?characterName=가나다라마바사아자차카타파&serverId=unknown'
  )
  await act(async () => root.render(<WebApp host={host} />))

  expect(container.querySelector('main section')?.textContent).toBe('검색할 수 없는 이름입니다.')
  expect(container.querySelector('main header')?.textContent).toBe('캐릭터 검색서버전체')
  expect(searchRequests(fetch)).toEqual([])
})

it('모험단 검색을 제출하면 다듬은 이름의 모험단 화면으로 가고, 그 모험단에 캐릭터가 없으면 없는 주소 화면을 보인다', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
    const url = new URL(new Request(...args).url)
    if (url.pathname.startsWith('/api/adventures/')) {
      return Response.json({ adventureName: '없는 모험단', characters: [] })
    }

    return Response.json({ percent: 85, expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
  })
  vi.stubGlobal('fetch', fetch)
  await act(async () => root.render(<WebApp host={host} />))
  await chooseScope('모험단')

  await searchName(' 없는 모험단 ')

  await waitForPath(`/adventures/${encodeURIComponent('없는 모험단')}`)
  await vi.waitFor(() =>
    expect(container.querySelector('main h1')?.textContent).toBe('없는 주소입니다.')
  )
  expect(searchRequests(fetch)).toEqual([])
})

it('전역 검색창의 Alt+방향키와 글자 붙여넣기는 브라우저 기본 동작을 막지 않고 표의 자리와 회차 안내를 바꾸지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  const input = container.querySelector<HTMLInputElement>('header input[aria-label="캐릭터 이름"]')!
  const before = seats().map(nameOf)
  const status = captureStatus()
  const altArrow = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    altKey: true,
    bubbles: true,
    cancelable: true
  })
  const paste = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(paste, 'clipboardData', {
    value: { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] }
  })

  await act(async () => {
    input.dispatchEvent(altArrow)
    input.dispatchEvent(paste)
  })

  expect(altArrow.defaultPrevented).toBe(false)
  expect(paste.defaultPrevented).toBe(false)
  expect(seats().map(nameOf)).toEqual(before)
  expect(captureStatus()).toBe(status)
})

function summaryStar(): HTMLButtonElement | null {
  return container.querySelector(
    'section[aria-label="캐릭터 요약"] button:is([aria-label="즐겨찾기에 더하기"], [aria-label="즐겨찾기 해제"])'
  )
}

function favoriteRows(): (string | null)[] {
  return [...container.querySelectorAll('section[aria-label="즐겨찾기한 캐릭터"] tbody tr')].map(
    (row) => row.querySelector('a')?.getAttribute('href') ?? null
  )
}

function globalMenuLink(label: string): HTMLAnchorElement {
  return [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="전역 메뉴"] a')].find(
    (link) => link.textContent === label
  )!
}

it('상세의 별로 켠 즐겨찾기는 다시 열어도 켜져 있고, 즐겨찾기 화면에서 해제하면 목록에서 빠지고 상세의 별도 꺼진다', async () => {
  stubDetailFetch()
  window.history.replaceState(null, '', DETAIL_PATH)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() =>
    expect(summaryStar()?.getAttribute('aria-label')).toBe('즐겨찾기에 더하기')
  )

  await act(async () => summaryStar()!.click())

  expect(summaryStar()?.getAttribute('aria-label')).toBe('즐겨찾기 해제')
  await act(async () => root.unmount())
  const savedText = localStorage.getItem('dfragon:favorite-characters') ?? ''
  useFavoriteCharacterStore.setState({ favoriteCharacters: [] })
  localStorage.setItem('dfragon:favorite-characters', savedText)
  await act(async () => useFavoriteCharacterStore.persist.rehydrate())
  root = createRoot(container)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() => expect(summaryStar()?.getAttribute('aria-label')).toBe('즐겨찾기 해제'))

  await act(async () => globalMenuLink('즐겨찾기').click())

  await waitForPath('/favorites')
  expect(container.querySelector('main h1')?.textContent).toBe('즐겨찾기')
  expect(favoriteRows()).toEqual([DETAIL_PATH])
  const unfavorite = container.querySelector<HTMLButtonElement>(
    'section[aria-label="즐겨찾기한 캐릭터"] button[aria-label="즐겨찾기 해제"]'
  )!
  await act(async () => unfavorite.click())

  expect(favoriteRows()).toEqual([])
  expect(container.querySelector('section[aria-label="즐겨찾기한 캐릭터"]')?.textContent).toBe(
    '즐겨찾기한 캐릭터즐겨찾기한 캐릭터가 없습니다.'
  )
  await act(async () => window.history.back())
  await waitForPath(DETAIL_PATH)
  await vi.waitFor(() =>
    expect(summaryStar()?.getAttribute('aria-label')).toBe('즐겨찾기에 더하기')
  )
})

function recentPopup(): HTMLElement | null {
  return document.querySelector('[aria-label="최근 본 캐릭터"]')
}

it('상세를 연 캐릭터는 비어 있는 이름 칸에 초점이 가면 최근 본 캐릭터로 보이고, 이름을 쓰면 닫히며, 지우면 목록에서 빠진다', async () => {
  stubDetailFetch()
  window.history.replaceState(null, '', DETAIL_PATH)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() => expect(summaryStar()).not.toBeNull())
  const input = container.querySelector<HTMLInputElement>('header input[aria-label="캐릭터 이름"]')!
  expect(recentPopup()).toBeNull()

  await act(async () => input.focus())

  await vi.waitFor(() => expect(recentPopup()).not.toBeNull())
  const items = [...recentPopup()!.querySelectorAll<HTMLAnchorElement>('li a')]
  expect(items.map((item) => [item.getAttribute('href'), item.textContent])).toEqual([
    [DETAIL_PATH, '하늘프레이126,965']
  ])
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '하')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await vi.waitFor(() => expect(recentPopup()).toBeNull())
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await vi.waitFor(() => expect(recentPopup()).not.toBeNull())

  const remove = recentPopup()!.querySelector<HTMLButtonElement>(
    'button[aria-label="하늘 최근 목록에서 지우기"]'
  )!
  await act(async () => remove.click())

  await vi.waitFor(() => expect(recentPopup()).toBeNull())
  expect(document.activeElement).toBe(input)
  expect(JSON.parse(localStorage.getItem('dfragon:recent-characters') ?? '{}')).toMatchObject({
    state: { recentCharacters: [] }
  })
})

it('내 모험단에 이름을 넣고 보기를 누르면 그 모험단의 주간 던파만 조회하고 이름은 브라우저에 남긴다', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
    const url = new URL(new Request(...args).url)
    if (url.pathname.endsWith('/weekly')) {
      return Response.json({ adventureName: '합성 모험단', clearNames: [], characters: [] })
    }

    return Response.json({ percent: 85, expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
  })
  vi.stubGlobal('fetch', fetch)
  window.history.replaceState(null, '', '/my')
  await act(async () => root.render(<WebApp host={host} />))

  expect(globalMenu()).toEqual([
    ['파티, 공대', null],
    ['내 모험단', 'page'],
    ['즐겨찾기', null]
  ])
  const form = container.querySelector<HTMLFormElement>('main form')!
  const input = form.querySelector<HTMLInputElement>('input[aria-label="내 모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      ' 합성 모험단 '
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => form.requestSubmit())

  await vi.waitFor(() =>
    expect(container.querySelector('main section h2')?.textContent).toBe('합성 모험단')
  )
  const urls = fetch.mock.calls.map((args) => new Request(...args).url)
  const encodedName = encodeURIComponent('합성 모험단')
  expect(urls.filter((url) => url.includes(encodedName))).toEqual([
    `${API_BASE_URL}/adventures/${encodedName}/weekly`
  ])
  expect(localStorage.getItem('dfragon:my-adventure')).toContain('합성 모험단')
})
