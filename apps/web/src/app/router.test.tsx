// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { RouterProvider } from '@tanstack/react-router'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import neopleOpenApiColorLogo from '#shared/assets/neople-open-api-color.png'
import neopleOpenApiGrayLogo from '#shared/assets/neople-open-api-gray.png'
import { useFavoriteCharacterStore } from '#features/favorite-character'
import { useMyAdventureStore } from '#entities/adventure-guild'
import {
  BrowserHostContext,
  useSearchModeStore,
  installBrowserHost,
  type AutoRoundSignal,
  type BrowserHost,
  decodeBrowserImage,
  readRaidWindowTemplates,
  readTownIndicatorTemplate,
  WEB_CAPTURE_TEXTS
} from '#features/capture-search'
import { getRouter } from './router'
import { CHARACTER_SERVER_NAMES, type CharacterCandidate, RANKING_JOBS } from '#entities/character'
import { WEB_SCREEN_WATCH_TEXTS } from '#pages/multisearch'
import { API_BASE_URL as SITE_API_URL } from '#shared/api/dfragon-api'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { fameRankingHandlers } from '#entities/ranking/api/fame-ranking.handlers'
import { labItemsHandlers } from '#pages/lab/api/lab-items.handlers'
import { enchantOptionsHandlers } from '#pages/character-simulator/api/enchant-options.handlers'
import { soulPricesHandlers } from '#pages/home/api/soul-prices.handlers'
import { characterStatsHandlers } from '#pages/stats/api/stats.handlers'
import { skillStatsHandlers } from '#entities/ranking/api/skill-stats.handlers'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import { server } from '#testing/test-support/msw-server'
import { todayGradeHandlers } from '#widgets/global-bar/api/today-grade.handlers'

vi.mock('#features/capture-search/lib/browser-png', () => ({
  decodeBrowserImage: vi.fn(),
  decodeBrowserPng: vi.fn()
}))
vi.mock('#features/capture-search/lib/screen-watch/browser-raid-templates', () => ({
  readRaidWindowTemplates: vi.fn()
}))
vi.mock('#features/capture-search/lib/screen-watch/browser-town-template', () => ({
  readTownIndicatorTemplate: vi.fn()
}))

// html, head, body를 그리는 문서 틀은 테스트 container 안에 둘 수 없어 내용과 route의 head만 그린다.
vi.mock('#app/RootDocument', async () => {
  const { HeadContent } = await import('@tanstack/react-router')

  return {
    RootDocument: ({ children }: { children: React.ReactNode }) => (
      <>
        <HeadContent />
        {children}
      </>
    )
  }
})

const API_BASE_URL = 'https://site.example.test/api'

// 브라우저 진입점(client.tsx)처럼 host를 router 위에 둔다.
function WebApp({ host }: { host: BrowserHost }): React.JSX.Element {
  const [router] = useState(getRouter)

  return (
    <BrowserHostContext value={host}>
      <RouterProvider router={router} />
    </BrowserHostContext>
  )
}

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

async function captureStatus(): Promise<string | null> {
  const chip = container.querySelector('button[aria-label^="화면 공유"]')!
  const trigger = chip.parentElement!
  const openPopup = (): Element | null =>
    document.querySelector('[data-base-ui-portal] > [data-open]')

  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('mouseenter'))
  })
  const popup = await vi.waitFor(() => {
    const opened = openPopup()
    if (opened === null) {
      throw new Error('Tooltip이 열리지 않았다')
    }

    return opened
  })

  const text = popup.textContent
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('mouseleave'))
  })
  await vi.waitFor(() => {
    if (openPopup() !== null) {
      throw new Error('Tooltip이 닫히지 않았다')
    }
  })

  return text
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

function footerLinks(): [string | null, string | null, string | null][] {
  return [...container.querySelectorAll('footer[aria-label="사이트 정보"] a')].map((link) => [
    link.textContent,
    link.getAttribute('href'),
    link.getAttribute('aria-current')
  ])
}

function footerLink(name: string): HTMLAnchorElement {
  return [
    ...container.querySelectorAll<HTMLAnchorElement>('footer[aria-label="사이트 정보"] a')
  ].find((link) => link.textContent === name)!
}

function homeLink(): HTMLAnchorElement {
  return [...container.querySelectorAll<HTMLAnchorElement>('main a')].find(
    (link) => link.textContent === '첫 화면으로'
  )!
}

function labTabs(): [string | null, string | null, string | null][] {
  return [...container.querySelectorAll('nav[aria-label="실험실 종류"] a')].map((link) => [
    link.textContent,
    link.getAttribute('href'),
    link.getAttribute('aria-current')
  ])
}

async function openLabMultisearch(): Promise<void> {
  const link = [
    ...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="실험실 종류"] a')
  ].find((tab) => tab.textContent === '멀티서치')!

  await act(async () => link.click())
  await waitForPath('/lab/multisearch')
}

async function openHome(): Promise<void> {
  const brand = container.querySelector<HTMLAnchorElement>('a[aria-label="DFragon 첫 화면"]')!
  await act(async () => brand.click())
  await waitForPath('/')
}

async function waitForPath(pathname: string): Promise<void> {
  await vi.waitFor(() => expect(window.location.pathname).toBe(pathname))
}

let root: Root
let container: HTMLDivElement
let host: BrowserHost
let requested: URL[]

function recordRequest({ request }: { request: Request }): void {
  requested.push(new URL(request.url))
}

// 화면이 확인하지 않는 조회는 실패로 돌려준다.
function failure(): HttpResponse<object> {
  return HttpResponse.json(
    { error: { code: 'INTERNAL_SERVER_ERROR', message: '받지 못했습니다.' } },
    { status: 500 }
  )
}

function requestedPaths(pathname: string): URL[] {
  return requested.filter((url) => url.pathname === new URL(`${SITE_API_URL}${pathname}`).pathname)
}

// host는 페이지당 한 번 설치하고 문서 listener를 해제하지 않으므로 테스트도 한 번만 설치한다.
beforeAll(() => {
  host = installBrowserHost(API_BASE_URL)
})

beforeEach(() => {
  window.history.replaceState(null, '', '/lab/multisearch')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // 라우터는 화면을 옮길 때 창 스크롤을 처음으로 돌리는데 jsdom에는 scrollTo가 없다.
  vi.stubGlobal('scrollTo', vi.fn())
  vi.mocked(decodeBrowserImage).mockResolvedValue(pastedImage)
  vi.mocked(readTownIndicatorTemplate).mockResolvedValue(pastedImage)
  vi.mocked(readRaidWindowTemplates).mockRejectedValue(new Error('no templates'))
  requested = []
  server.events.on('request:start', recordRequest)
  server.use(
    todayGradeHandlers.grade(85),
    fameRankingHandlers.empty,
    soulPricesHandlers.prices,
    oathCatalogHandlers.notUploaded
  )
  localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  server.events.removeListener('request:start', recordRequest)
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
  expect(requested.map(String)).toContain(`${SITE_API_URL}/items/today-grade`)
})

it('화면 밖에 빌드 commit을 둔다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  const buildCommit = [...container.querySelectorAll('span')].find(
    (span) => span.textContent === __BUILD_COMMIT__
  )!

  expect(buildCommit.closest('footer, a, header, main')).toBeNull()
})

it('통계 화면의 표본 정보를 화면 밖 빌드 commit 위에 둔다', async () => {
  window.history.replaceState(null, '', '/stats')
  server.use(characterStatsHandlers.stats)

  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(
      [...container.querySelectorAll('div')].some(
        (element) =>
          element.closest('main, header, footer') === null &&
          /^캐릭터 [\d,]+, 마지막 업데이트 /.test(element.textContent)
      )
    ).toBe(true)
  )
})

it('실험실 멀티서치는 전역 바에 아이콘 없는 브랜드 글자, 지금 항목 없는 전역 메뉴, 검색창, 오늘 등급, 모드 전환 버튼을 두고 화면 상자에 멀티서치를 고른 실험실 탭과 게임 바, 표를 둔다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  const header = container.querySelector('header')!
  const brand = header.querySelector('a[aria-label="DFragon 첫 화면"]')!
  const grade = header.querySelector('[role="img"]')!
  expect(brand.getAttribute('href')).toBe('/')
  expect(brand.textContent).toBe('DFragon')
  expect(brand.querySelector('img')).toBeNull()
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
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
  expect(labTabs()).toEqual([
    ['마법부여', '/lab/enchants', null],
    ['멀티서치', '/lab/multisearch', 'page']
  ])
  const labNav = main.querySelector('nav[aria-label="실험실 종류"]')!
  const tabs = main.querySelector('[role="tablist"][aria-label="화면"]')!
  const boardTitle = main.querySelector('h1')!
  expect(labNav.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(boardTitle.textContent).toBe('파티')
  expect(tabs.compareDocumentPosition(boardTitle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(seats()).toHaveLength(4)
})

it('메인 화면은 전역 바에 검색창과 현재 메뉴 항목 없이, 화면 상자에 큰 검색창과 소울 결정 가격 제목만 둔다', async () => {
  window.history.replaceState(null, '', '/')
  await act(async () => root.render(<WebApp host={host} />))

  const header = container.querySelector('header')!
  expect(header.querySelector('form[role="search"]')).toBeNull()
  expect(
    [...header.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))
  ).toEqual(['다크 모드로 바꾸기'])
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
  ])

  const main = container.querySelector('main')!
  expect(
    [...homeSearchBox().querySelectorAll('button, input[type="search"]')].map((control) =>
      control.getAttribute('aria-label')
    )
  ).toEqual(['검색 대상', '캐릭터 이름', '검색'])
  expect([...main.querySelectorAll('h1, h2, h3')].map((title) => title.textContent)).toEqual([
    '소울 결정 가격'
  ])
  expect(main.querySelector('p')).toBeNull()
  expect(seats()).toHaveLength(0)
})

it('없는 주소는 전역 바 아래에 열려던 주소, 안내, 첫 화면 링크만 두고 링크를 누르면 메인 화면으로 간다', async () => {
  window.history.replaceState(null, '', '/guide?from=1')
  await act(async () => root.render(<WebApp host={host} />))

  const main = container.querySelector('main')!
  expect(main.querySelector('h1')?.textContent).toBe('없는 주소입니다.')
  expect(main.querySelector('p')?.textContent).toBe(`${window.location.host}/guide?from=1`)
  expect(homeLink().getAttribute('href')).toBe('/')
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
  ])
  expect(container.querySelector('[role="tablist"]')).toBeNull()
  expect(container.querySelector('button[aria-label^="화면 공유"]')).toBeNull()
  expect(seats()).toHaveLength(0)

  await act(async () => homeLink().click())

  await waitForPath('/')
  expect(homeSearchBox()).not.toBeNull()
  expect(container.querySelector('main section h2')?.textContent).toBe('소울 결정 가격')
  expect(container.querySelector('header form[role="search"]')).toBeNull()
})

it.each([
  ['/terms', '이용약관'],
  ['/privacy', '개인정보처리방침']
])('%s를 직접 열면 %s 제목 줄을 그리고 전역 메뉴에는 현재 항목이 없다', async (path, title) => {
  window.history.replaceState(null, '', path)
  await act(async () => root.render(<WebApp host={host} />))

  const main = container.querySelector('main')!
  const article = main.querySelector('article')!
  const heading = article.querySelector('h1')!
  expect(heading.textContent).toBe(title)
  expect(article.getAttribute('aria-labelledby')).toBe(heading.id)
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
  ])
})

it('화면 상자 아래 푸터에 Neople 로고 링크, 두 약관 화면 링크, 디스코드 링크를 두고 지금 화면 표시는 하지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  const main = container.querySelector('main')!
  const footer = container.querySelector('footer[aria-label="사이트 정보"]')!
  const neopleLink = footer.querySelector('a')!
  expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(neopleLink.getAttribute('target')).toBe('_blank')
  expect(
    [...neopleLink.querySelectorAll('img')].map((logo) => [
      logo.dataset.neopleLogo,
      logo.getAttribute('src'),
      logo.getAttribute('alt')
    ])
  ).toEqual([
    ['light', neopleOpenApiColorLogo, 'Neople 오픈 API'],
    ['dark', neopleOpenApiGrayLogo, 'Neople 오픈 API']
  ])
  expect(footerLinks()).toEqual([
    ['', 'https://developers.neople.co.kr', null],
    ['이용약관', '/terms', null],
    ['개인정보처리방침', '/privacy', null],
    ['디스코드', 'https://discord.gg/MMRhM22RXN', null]
  ])
  expect(footerLink('디스코드').target).toBe('_blank')
})

it('푸터의 약관 링크를 누르면 그 화면으로 가고 지금 화면의 링크만 현재 위치로 알린다', async () => {
  await act(async () => root.render(<WebApp host={host} />))

  await act(async () => footerLink('이용약관').click())

  await waitForPath('/terms')
  expect(container.querySelector('main h1')?.textContent).toBe('이용약관')
  expect(footerLinks().slice(1, 3)).toEqual([
    ['이용약관', '/terms', 'page'],
    ['개인정보처리방침', '/privacy', null]
  ])

  await act(async () => footerLink('개인정보처리방침').click())

  await waitForPath('/privacy')
  expect(container.querySelector('main h1')?.textContent).toBe('개인정보처리방침')
  expect(footerLinks().slice(1, 3)).toEqual([
    ['이용약관', '/terms', null],
    ['개인정보처리방침', '/privacy', 'page']
  ])
})

it('여러 필터가 붙은 검색 주소에서 초기화를 누르면 query 없는 검색 주소로 가서 필터를 처음 상태로 돌린다', async () => {
  server.use(
    http.get(`${SITE_API_URL}/stats/sets`, failure),
    http.get(`${SITE_API_URL}/stats/items`, failure),
    skillStatsHandlers.failure,
    ...skillWindowHandlers([])
  )
  const [job] = RANKING_JOBS
  window.history.replaceState(
    null,
    '',
    `/rankings?jobId=${job!.jobId}&jobGrowId=${job!.grows[0]!.jobGrowId}&oathSetId=16204&itemIds=synthetic-weapon&fameFrom=136000&fameTo=138000`
  )
  await act(async () => root.render(<WebApp host={host} />))

  const reset = await vi.waitFor(() => {
    const button = [...container.querySelectorAll<HTMLButtonElement>('main button')].find(
      (candidate) => candidate.textContent === '초기화'
    )
    expect(button?.disabled).toBe(false)

    return button!
  })
  await act(async () => reset.click())

  await vi.waitFor(() => expect(window.location.search).toBe(''))
  expect(window.location.pathname).toBe('/rankings')
  expect(reset.disabled).toBe(true)
  expect(
    [...container.querySelectorAll('main button[data-pressed]')].map((chip) => chip.textContent)
  ).toEqual(['직업 전체', '전직 전체'])
  expect(
    [...container.querySelectorAll<HTMLInputElement>('main input[inputmode="numeric"]')].map(
      (input) => input.value
    )
  ).toEqual(['', ''])
})

it('직업 필터가 붙은 검색 주소에서도 전역 메뉴의 검색을 지금 화면으로 표시한다', async () => {
  server.use(
    http.get(`${SITE_API_URL}/stats/sets`, failure),
    http.get(`${SITE_API_URL}/stats/items`, failure)
  )
  window.history.replaceState(null, '', `/rankings?jobId=${RANKING_JOBS[0]!.jobId}`)
  await act(async () => root.render(<WebApp host={host} />))

  expect(globalMenu()).toEqual([
    ['검색', 'page'],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
  ])
})

const DETAIL_PATH = '/c/prey/buffer-1'

// 캐릭터 상세는 host가 아니라 화면의 hook이 사이트 origin의 /api로 요청한다.
const DETAIL_URL = `${SITE_API_URL}/characters/prey/buffer-1`

function serveDetail(): void {
  server.use(
    http.get(DETAIL_URL, () => {
      const lastSuccessfulFetchAt = new Date().toISOString()

      return HttpResponse.json({
        character: {
          serverId: 'prey',
          characterId: 'buffer-1',
          characterName: '하늘',
          fame: 126965
        },
        freshness: { lastSuccessfulFetchAt },
        card: { role: 'buffer', score: null }
      })
    })
  )
}

function detailRequests(): number {
  return requested.filter((url) => url.pathname.includes('/characters/prey/')).length
}

function selectedTab(): string | null | undefined {
  return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent
}

it('캐릭터 주소를 직접 열면 주소의 tab으로 요약과 탭을 그리고, 탭을 바꾸면 다시 조회하지 않고 지금 기록의 tab만 바꾼다', async () => {
  serveDetail()
  window.history.replaceState(null, '', `${DETAIL_PATH}?tab=skill`)
  const historyLength = window.history.length
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(container.querySelector('main h1')?.textContent).toBe('하늘'))
  expect(selectedTab()).toBe('스킬')
  // 브라우저에서는 loader가 상세를 기다리지 않으므로, 받은 뒤에 제목이 캐릭터 이름으로 바뀐다.
  await vi.waitFor(() => expect(document.title).toBe('하늘 - DFragon'))
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
  ])

  const statusTab = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (tab) => tab.textContent === '스탯'
  )!
  await act(async () => statusTab.click())

  await vi.waitFor(() => expect(window.location.search).toBe('?tab=status'))
  expect(selectedTab()).toBe('스탯')
  expect(window.history.length).toBe(historyLength)
  expect(detailRequests()).toBe(1)
})

it('장비 시뮬레이터 주소를 열면 캐릭터 상세 안이 아닌 시뮬레이터 화면만 그리고 전역 메뉴의 장비 시뮬레이터를 지금 항목으로 둔다', async () => {
  serveDetail()
  server.use(
    http.post(`${DETAIL_URL}/simulation`, () =>
      HttpResponse.json({ baseline: null, simulated: null })
    ),
    ...enchantOptionsHandlers.options()
  )
  window.history.replaceState(null, '', `${DETAIL_PATH}/simulator`)
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('main h1')?.textContent).toBe('장비 시뮬레이터')
  )
  expect(document.title).toBe('장비 시뮬레이터 - DFragon')
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  expect(container.querySelector('section[aria-label="캐릭터 요약"]')).toBeNull()
  expect(container.querySelector('[role="tablist"]')).toBeNull()
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', 'page']
  ])
})

it('실험실 주소는 기록을 늘리지 않고 마법부여 주소로 바꾸고, 전역 메뉴에는 지금 항목을 두지 않는다', async () => {
  server.use(labItemsHandlers.items)
  window.history.replaceState(null, '', '/lab')
  const historyLength = window.history.length
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath('/lab/enchants')
  expect(window.history.length).toBe(historyLength)
  expect(document.title).toBe('실험실 마법부여 - DFragon')
  await vi.waitFor(() => expect(container.querySelector('main table')).not.toBeNull())
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', null],
    ['장비 시뮬레이터', null]
  ])
})

it('옛 멀티서치 주소는 기록을 늘리지 않고 실험실 멀티서치 주소로 바꾼다', async () => {
  window.history.replaceState(null, '', '/multisearch')
  const historyLength = window.history.length
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath('/lab/multisearch')
  expect(window.history.length).toBe(historyLength)
  expect(document.title).toBe('실험실 멀티서치 - DFragon')
  await vi.waitFor(() => expect(seats()).toHaveLength(4))
})

it('길드 주소를 열면 길드를 받은 뒤 제목이 길드 이름으로 바뀐다', async () => {
  server.use(
    http.get(`${SITE_API_URL}/guilds/guild-1`, () =>
      HttpResponse.json({ guildId: 'guild-1', guildName: '길드1', memberCount: 0, members: [] })
    )
  )
  window.history.replaceState(null, '', '/guilds/guild-1')
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(document.title).toBe('길드1 길드 - DFragon'))
  expect(requested.filter((url) => url.pathname.includes('/guilds/'))).toHaveLength(1)
})

function serveAdventure(): void {
  server.use(
    http.get(`${SITE_API_URL}/adventures/:adventureName/weekly`, ({ params }) =>
      HttpResponse.json({ adventureName: params.adventureName, clearNames: [], characters: [] })
    ),
    http.get(`${SITE_API_URL}/adventures/:adventureName/activity`, failure)
  )
}

function adventureRequests(): string[] {
  return requested
    .map(String)
    .filter((url) => url.startsWith(`${SITE_API_URL}/adventures/`))
    .toSorted()
}

it('한글 모험단 이름의 주소를 직접 열면 저장한 모험단과 달라도 그 모험단의 대시보드를 그리고 저장한 이름은 그대로 둔다', async () => {
  useMyAdventureStore.setState({ adventureName: '저장 모험단' })
  serveAdventure()
  const encodedName = encodeURIComponent('동네커피')
  window.history.replaceState(null, '', `/adventures/${encodedName}`)
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('main section h2')?.textContent).toBe('동네커피')
  )
  expect(container.querySelector('main h1')?.textContent).toBe('동네커피')
  expect(container.querySelector<HTMLInputElement>('main input[aria-label="모험단"]')?.value).toBe(
    '동네커피'
  )
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', 'page'],
    ['장비 시뮬레이터', null]
  ])
  expect(adventureRequests()).toEqual([
    `${SITE_API_URL}/adventures/${encodedName}/activity`,
    `${SITE_API_URL}/adventures/${encodedName}/weekly`
  ])
  expect(useMyAdventureStore.getState().adventureName).toBe('저장 모험단')
})

it('모험단 주소는 저장한 모험단이 있으면 기록을 늘리지 않고 그 모험단 주소로 season과 함께 바꾼다', async () => {
  useMyAdventureStore.setState({ adventureName: '합성 모험단' })
  serveAdventure()
  window.history.replaceState(null, '', '/adventures?season=10')
  const historyLength = window.history.length
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath(`/adventures/${encodeURIComponent('합성 모험단')}`)
  expect(window.location.search).toBe('?season=10')
  expect(window.history.length).toBe(historyLength)
})

// 세트 id는 웹의 줄임말 표에 있는 게임 값이다.
const FAIRY_SET = '4ee7bd5912cda6e2a24c1f36d5202b46'
const ONYX_SET = '11f7d203a05ea6f13300c0facb39f11e'

function equipmentCharacter(serverId: 'cain' | 'siroco', name: string) {
  return {
    serverId,
    characterId: `${serverId}-character`,
    characterName: name,
    adventureName: '합성 모험단',
    level: 115,
    jobId: null,
    jobGrowId: null,
    jobName: null,
    jobGrowName: null,
    fame: 1000,
    guildId: null,
    guildName: null,
    role: null,
    equipment: [],
    oaths: []
  }
}

function serveEquipment(): void {
  const cainCharacter = equipmentCharacter('cain', '카인캐릭터')
  const sirocoCharacter = equipmentCharacter('siroco', '시로코캐릭터')

  server.use(
    http.get(`${SITE_API_URL}/adventures/:adventureName/equipment`, ({ params, request }) => {
      const query = new URL(request.url).searchParams
      const serverId = query.get('server') === 'siroco' ? 'siroco' : 'cain'
      const setItemId = query.get('set') === FAIRY_SET ? FAIRY_SET : ONYX_SET
      const cainCharacters = serverId === 'cain' ? [cainCharacter] : []
      const sirocoCharacters = serverId === 'siroco' ? [sirocoCharacter] : []

      return HttpResponse.json({
        adventureName: params.adventureName,
        sets: [
          { setItemId: ONYX_SET, setItemName: '칠흑의 정화 세트' },
          { setItemId: FAIRY_SET, setItemName: '소울 페어리 세트' }
        ],
        servers: [
          { serverId: 'cain', characters: cainCharacters },
          { serverId: 'siroco', characters: sirocoCharacters }
        ],
        selected: { serverId, setItemId }
      })
    })
  )
}

function adventureTabs(): [string | null, string | null][] {
  return [...container.querySelectorAll('nav[aria-label="모험단"] a')].map((link) => [
    link.textContent,
    link.getAttribute('aria-current')
  ])
}

function equipmentNames(): (string | null)[] {
  return [...container.querySelectorAll('section[aria-label="장비"] table tbody tr a')].map(
    (link) => link.textContent
  )
}

function pressedChip(group: string): string | null | undefined {
  return container.querySelector(
    `[role="group"][aria-label="${group}"] button[aria-pressed="true"]`
  )?.textContent
}

async function clickText(selector: string, text: string): Promise<void> {
  const target = [...container.querySelectorAll<HTMLElement>(selector)].find(
    (element) => element.textContent === text
  )!
  await act(async () => target.click())
}

it('모험단 화면의 장비 탭을 누르면 장비 주소로 가고, 세트와 서버를 바꾸면 주소에 남아 다시 열어도 같은 표를 보인다', async () => {
  serveAdventure()
  serveEquipment()
  const encodedName = encodeURIComponent('합성 모험단')
  window.history.replaceState(null, '', `/adventures/${encodedName}`)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() =>
    expect(adventureTabs()).toEqual([
      ['활동', 'page'],
      ['장비', null],
      ['타임라인', null]
    ])
  )

  await clickText('nav[aria-label="모험단"] a', '장비')
  await waitForPath(`/adventures/${encodedName}/equipment`)
  await vi.waitFor(() => expect(equipmentNames()).toEqual(['카인캐릭터']))
  expect(adventureTabs()).toEqual([
    ['활동', null],
    ['장비', 'page'],
    ['타임라인', null]
  ])
  expect(pressedChip('세트')).toBe('칠흑')

  await clickText('[role="group"][aria-label="세트"] button', '페어리')
  await clickText('[role="group"][aria-label="서버"] button', '시로코')
  await vi.waitFor(() =>
    expect(new URLSearchParams(window.location.search)).toEqual(
      new URLSearchParams({ server: 'siroco', set: FAIRY_SET })
    )
  )
  await vi.waitFor(() => expect(equipmentNames()).toEqual(['시로코캐릭터']))

  const address = `${window.location.pathname}${window.location.search}`
  await act(async () => root.unmount())
  root = createRoot(container)
  window.history.replaceState(null, '', address)
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(equipmentNames()).toEqual(['시로코캐릭터']))
  expect(pressedChip('서버')).toBe('시로코')
  expect(pressedChip('세트')).toBe('페어리')
})

it('활동 탭의 갱신을 누르면 받아 둔 장비 조회도 다시 받는다', async () => {
  serveAdventure()
  serveEquipment()
  const encodedName = encodeURIComponent('합성 모험단')
  const equipmentPath = `/adventures/${encodedName}/equipment`
  window.history.replaceState(null, '', equipmentPath)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() => expect(equipmentNames()).toEqual(['카인캐릭터']))

  await clickText('nav[aria-label="모험단"] a', '활동')
  await waitForPath(`/adventures/${encodedName}`)
  await vi.waitFor(() =>
    expect(container.querySelector('main h1')?.textContent).toBe('합성 모험단')
  )
  await clickText('main button', '갱신')
  await vi.waitFor(() => {
    const refresh = container.querySelector<HTMLButtonElement>('main form button[type="button"]')
    expect(refresh?.textContent).toBe('갱신')
    expect(refresh?.disabled).toBe(true)
  })
  await clickText('nav[aria-label="모험단"] a', '장비')

  await vi.waitFor(() =>
    expect(requestedPaths(`/adventures/${encodedName}/equipment`)).toHaveLength(2)
  )
})

it('컨텐츠를 고른 예전 클리어 주소는 기록을 늘리지 않고 같은 컨텐츠 묶음과 단계, 주의 상세 주소로 바꾼다', async () => {
  server.use(http.get(`${SITE_API_URL}/stats/clears`, failure))
  window.history.replaceState(null, '', '/clears?content=nabel-hard&week=2026-11-05')
  const historyLength = window.history.length
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath('/clears/nabel')
  expect(window.location.search).toBe('?stage=hard&week=2026-11-05')
  expect(window.history.length).toBe(historyLength)
})

it('컨텐츠 id로 연 클리어 상세 주소는 컨텐츠 묶음 주소와 단계 query로 바꾼다', async () => {
  server.use(http.get(`${SITE_API_URL}/stats/clears`, failure))
  window.history.replaceState(null, '', '/clears/michaela-normal?week=2026-11-05')
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath('/clears/michaela')
  expect(window.location.search).toBe('?stage=normal&week=2026-11-05')
})

function serveClears(): void {
  const week = {
    weekStart: '2026-11-05',
    closed: true,
    collectedAt: '2026-11-11T22:00:00.000Z',
    population: 1000,
    minFame: 104292,
    cleared: 50,
    newlyCleared: null,
    ratios: [{ ratio: null, cleared: 50 }]
  }
  const header = {
    id: 'michaela-hard',
    kind: 'raid',
    name: '무너진 성자 미카엘라 (하드)',
    releasedAt: '2026-08-05T21:00:00.000Z',
    entryFame: 104292,
    latest: true
  }
  const detail = {
    ...header,
    week,
    jobs: [],
    adventures: [],
    weeklyClears: [],
    fameBands: [],
    weekOverWeek: null,
    stageMoves: null,
    streaks: null,
    stages: null,
    scoreBands: { equipment: [], buff: [] },
    weekdays: [],
    hours: []
  }
  const overview = { weekStart: '2026-11-05', contents: [], weekdays: [], hours: [] }
  server.use(
    http.get(`${SITE_API_URL}/stats/clears`, () =>
      HttpResponse.json({ contents: [{ ...header, weeks: [week] }], legions: [] })
    ),
    http.get(`${SITE_API_URL}/stats/clears/overview`, () => HttpResponse.json(overview)),
    http.get(`${SITE_API_URL}/stats/clears/michaela-hard`, () => HttpResponse.json(detail))
  )
}

it('클리어 상세에서 고른 컨텐츠 카드를 다시 누르면 같은 주의 전체 개요로 돌아간다', async () => {
  serveClears()
  window.history.replaceState(null, '', '/clears/michaela?week=2026-11-05')
  await act(async () => root.render(<WebApp host={host} />))

  const selected = await vi.waitFor(() => {
    const card = container.querySelector('nav[aria-label="컨텐츠"] button[aria-pressed="true"]')
    expect(card).not.toBeNull()

    return card!
  })
  await act(async () => {
    selected.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })

  await waitForPath('/clears')
  expect(window.location.search).toBe('?week=2026-11-05')
})

it('캐릭터 주소의 tab이 모르는 값이면 장비 탭을 연다', async () => {
  serveDetail()
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

it('멀티서치에서 고친 이름과 맞바꾼 자리는 메인 화면에 다녀와도 남는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
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

  await openHome()
  expect(seats()).toHaveLength(0)
  await act(async () => window.history.back())
  await waitForPath('/lab/multisearch')

  await vi.waitFor(() => expect(seats().map(nameOf)).toEqual(before))
})

it('화면 공유는 메인 화면에 다녀와도 연결된 채 남고, 다른 화면에서 공유를 멈추면 돌아왔을 때 연결 전이다', async () => {
  // jsdom에는 화면 공유와 video 재생이 없어 getDisplayMedia가 돌려주는 track과 stream만 흉내 낸다.
  const track = Object.assign(new EventTarget(), { label: 'Dungeon & Fighter', stop: vi.fn() })
  vi.stubGlobal('navigator', {
    mediaDevices: { getDisplayMedia: vi.fn(async () => ({ getVideoTracks: () => [track] })) }
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  await act(async () => root.render(<WebApp host={host} />))
  const chip = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="화면 공유"]')!
  await act(async () => chip().click())
  await vi.waitFor(() =>
    expect(chip().getAttribute('aria-label')).toBe('화면 공유 중지, 게임 연결됨')
  )

  await openHome()
  await act(async () => window.history.back())
  await waitForPath('/lab/multisearch')
  await vi.waitFor(() =>
    expect(chip().getAttribute('aria-label')).toBe('화면 공유 중지, 게임 연결됨')
  )

  await act(async () => window.history.forward())
  await waitForPath('/')
  await act(async () => track.dispatchEvent(new Event('ended')))
  await act(async () => window.history.back())
  await waitForPath('/lab/multisearch')

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결'))
  expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
})

it('다른 화면에서 붙여 넣은 이미지는 회차를 시작하지 않는다', async () => {
  server.use(labItemsHandlers.items)
  window.history.replaceState(null, '', '/lab/enchants')
  await act(async () => root.render(<WebApp host={host} />))

  await act(async () => pasteImage())
  await openLabMultisearch()

  expect(decodeBrowserImage).not.toHaveBeenCalled()
  expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
})

it('문서 전체의 드래그를 막지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  const event = new Event('dragstart', { bubbles: true, cancelable: true })

  document.body.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(false)
})

it('창을 고르기 전에는 붙여넣기 안내를 보이고, 이미지를 붙여 넣으면 지금 화면의 회차가 웹 문구로 진행된다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)

  await act(async () => pasteImage())

  // jsdom에는 Worker가 없어 OCR 준비 실패로 끝나므로 그 웹 문구까지 확인한다.
  await vi.waitFor(async () =>
    expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.ocrPrepareFailed)
  )
  expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(expect.any(File))
})

it('멀티서치 자리 행의 Alt+방향키는 브라우저에 넘기지 않고 이름 칸에서는 막지 않는다', async () => {
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
  await vi.waitFor(async () => expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.disconnected))
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

  await vi.waitFor(() =>
    expect(chip().getAttribute('aria-label')).toBe('화면 공유 중지, 게임 연결됨')
  )
  expect(chip().textContent).toBe('게임 연결됨')
  expect(captureButton().disabled).toBe(false)

  await act(async () => captureButton().click())

  await vi.waitFor(() =>
    expect(decodeBrowserImage).toHaveBeenCalledExactlyOnceWith(expect.any(HTMLVideoElement))
  )

  await act(async () => track.dispatchEvent(new Event('ended')))

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결'))
  expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
  expect(captureButton().disabled).toBe(true)
})

it('공유가 연결된 동안 게임 연결 칩을 누르면 창 공유를 다시 요청하지 않고 공유를 끊으며, 끊은 뒤 다시 공유할 수 있다', async () => {
  // jsdom에는 화면 공유와 video 재생이 없어 getDisplayMedia가 돌려주는 track과 stream만 흉내 낸다.
  const track = Object.assign(new EventTarget(), { label: 'Dungeon & Fighter', stop: vi.fn() })
  const getDisplayMedia = vi.fn(async () => ({ getVideoTracks: () => [track] }))
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  await act(async () => root.render(<WebApp host={host} />))
  const chip = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="화면 공유"]')!
  const captureButton = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="파티 캡처"]')!
  await act(async () => chip().click())
  await vi.waitFor(() =>
    expect(chip().getAttribute('aria-label')).toBe('화면 공유 중지, 게임 연결됨')
  )
  await act(async () => captureButton().click())
  // jsdom에는 Worker가 없어 회차가 OCR 준비 실패로 끝나므로, 공유가 남은 캡처 실패 칩에서 끊는다.
  await vi.waitFor(() =>
    expect(chip().getAttribute('aria-label')).toBe('화면 공유 중지, 캡처 실패')
  )

  await act(async () => chip().click())

  await vi.waitFor(() => expect(chip().getAttribute('aria-label')).toBe('화면 공유, 게임 연결'))
  expect(chip().textContent).toBe('화면 공유')
  expect(getDisplayMedia).toHaveBeenCalledOnce()
  expect(track.stop).toHaveBeenCalledOnce()
  expect(await captureStatus()).toBe(WEB_CAPTURE_TEXTS.noSource)
  expect(captureButton().disabled).toBe(true)

  await act(async () => chip().click())

  await vi.waitFor(() =>
    expect(chip().getAttribute('aria-label')).toBe('화면 공유 중지, 게임 연결됨')
  )
  expect(getDisplayMedia).toHaveBeenCalledTimes(2)
  await act(async () => host.party.selectCaptureSource(''))
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

  await vi.waitFor(async () =>
    expect(await captureStatus()).toBe(WEB_SCREEN_WATCH_TEXTS.party.waiting)
  )
  await act(async () => useSearchModeStore.setState({ searchMode: 'raid' }))
  expect(await captureStatus()).toBe(WEB_SCREEN_WATCH_TEXTS.raid.waiting)
  await act(async () => host.party.selectCaptureSource(''))
})

function candidateRow(
  characterName: string,
  serverId: 'cain' | 'prey',
  characterId: string,
  fame: number | null,
  score: { calculator: 'equipment' | 'buff'; value: number } | null = null
): CharacterCandidate & { score: { calculator: 'equipment' | 'buff'; value: number } | null } {
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
    jobGrowName: '眞 크루세이더',
    score
  }
}

function serveCharacterSearch(rows: readonly CharacterCandidate[]): void {
  server.use(
    http.get(`${SITE_API_URL}/characters`, () => HttpResponse.json({ rows })),
    http.get(`${SITE_API_URL}/characters/:serverId/:characterId`, failure)
  )
}

function searchRequests(): URL[] {
  return requestedPaths('/characters')
}

function searchBox(): HTMLFormElement {
  return container.querySelector<HTMLFormElement>('header form[role="search"]')!
}

function homeSearchBox(): HTMLFormElement {
  return container.querySelector<HTMLFormElement>('main form[role="search"]')!
}

async function chooseScope(label: string, box = searchBox()): Promise<void> {
  await act(async () =>
    box.querySelector<HTMLButtonElement>('button[aria-label="검색 대상"]')!.click()
  )
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === label
  )!
  await act(async () => option.click())
}

async function searchName(name: string, box = searchBox()): Promise<void> {
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
  serveCharacterSearch([candidateRow('한명', 'cain', 'only-1', 50000)])
  await act(async () => root.render(<WebApp host={host} />))

  await searchName(' 한명 ')

  await waitForPath('/search')
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    characterName: '한명',
    serverId: 'all'
  })
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([['/c/cain/only-1', '카인한명크루세이더(남)50,000-50,000-']])
  )
  expect(searchRequests().map((url) => Object.fromEntries(url.searchParams))).toEqual([
    { characterName: '한명', serverId: 'all', limit: '200' }
  ])

  await act(async () => container.querySelector<HTMLAnchorElement>('main tbody a')!.click())

  await waitForPath('/c/cain/only-1')
  await act(async () => window.history.back())
  await waitForPath('/search')
  await vi.waitFor(() => expect(searchResultRows()).toHaveLength(1))
})

it('서버를 고른 캐릭터 검색은 그 서버로 찾고 명성 순 응답을 그 순서대로 보인다', async () => {
  serveCharacterSearch([
    candidateRow('카인검색1', 'cain', 'server-1', 90000, { calculator: 'buff', value: 4_120_000 }),
    candidateRow('카인검색', 'cain', 'server-2', null)
  ])
  await act(async () => root.render(<WebApp host={host} />))
  await chooseScope('카인')

  await searchName('카인검색')

  await waitForPath('/search')
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([
      ['/c/cain/server-1', '카인카인검색1크루세이더(남)90,0004,120,00090,000버프4,120,000'],
      ['/c/cain/server-2', '카인카인검색크루세이더(남)----']
    ])
  )
  expect(container.querySelector('main h1')?.textContent).toBe('캐릭터 검색')
  expect(searchRequests().map((url) => url.searchParams.get('serverId'))).toEqual(['cain'])
})

it('캐릭터 이름 한 글자를 제출하면 검색 화면으로 가서 그 이름으로 찾는다', async () => {
  serveCharacterSearch([candidateRow('가', 'cain', 'single-1', 1000)])
  await act(async () => root.render(<WebApp host={host} />))

  await searchName('가')

  await waitForPath('/search')
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([['/c/cain/single-1', '카인가크루세이더(남)1,000-1,000-']])
  )
  expect(searchRequests().map((url) => url.searchParams.get('characterName'))).toEqual(['가'])
})

it('검색 결과가 없으면 검색한 이름의 목록 상자에 찾지 못했다는 문구를 보인다', async () => {
  serveCharacterSearch([])
  window.history.replaceState(null, '', '/search?characterName=없는이름&serverId=all')
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('main section p')?.textContent).toBe('캐릭터를 찾지 못했습니다.')
  )
  expect(container.querySelector('main section h2')?.textContent).toBe('없는이름')
  expect(container.querySelector('main table')).toBeNull()
})

it('주소의 이름이 열세 글자면 검색 화면은 요청하지 않는다', async () => {
  serveCharacterSearch([])
  window.history.replaceState(
    null,
    '',
    '/search?characterName=가나다라마바사아자차카타파&serverId=unknown'
  )
  await act(async () => root.render(<WebApp host={host} />))

  expect(container.querySelector('main section h2')?.textContent).toBe('가나다라마바사아자차카타파')
  expect(container.querySelector('main section p')?.textContent).toBe('검색할 수 없는 이름입니다.')
  expect(container.querySelector('main header')?.textContent).toBe('캐릭터 검색서버전체')
  expect(searchRequests()).toEqual([])
})

it('모험단 검색을 제출하면 다듬은 이름의 모험단 대시보드로 가고 저장한 이름은 바꾸지 않는다', async () => {
  serveAdventure()
  await act(async () => root.render(<WebApp host={host} />))
  await chooseScope('모험단')

  await searchName(' 없는 모험단 ')

  await waitForPath(`/adventures/${encodeURIComponent('없는 모험단')}`)
  await vi.waitFor(() =>
    expect(container.querySelector('main section h2')?.textContent).toBe('없는 모험단')
  )
  expect(container.querySelector('main h1')?.textContent).toBe('없는 모험단')
  expect(searchRequests()).toEqual([])
  expect(useMyAdventureStore.getState().adventureName).toBeNull()
})

it('메인 화면의 큰 검색창에 캐릭터 이름을 제출하면 전역 검색창처럼 검색 화면으로 가고, 그 화면의 전역 바에는 검색창이 다시 보인다', async () => {
  serveCharacterSearch([candidateRow('큰검색', 'cain', 'home-1', 1000)])
  window.history.replaceState(null, '', '/')
  await act(async () => root.render(<WebApp host={host} />))

  await searchName(' 큰검색 ', homeSearchBox())

  await waitForPath('/search')
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    characterName: '큰검색',
    serverId: 'all'
  })
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([['/c/cain/home-1', '카인큰검색크루세이더(남)1,000-1,000-']])
  )
  expect(searchRequests()).toHaveLength(1)
  expect(container.querySelector('header form[role="search"]')).not.toBeNull()
})

it('시뮬레이터 검색 주소는 전역 바에 검색창 없이 화면 상자에 모험단 대상이 없는 큰 검색창 하나만 둔다', async () => {
  window.history.replaceState(null, '', '/simulator')
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() => expect(document.title).toBe('장비 시뮬레이터 - DFragon'))
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  expect(container.querySelector('header form[role="search"]')).toBeNull()
  expect(globalMenu().find(([label]) => label === '장비 시뮬레이터')).toEqual([
    '장비 시뮬레이터',
    'page'
  ])
  const main = container.querySelector('main')!
  expect(main.querySelectorAll('form[role="search"]')).toHaveLength(1)
  expect(main.querySelectorAll('h1, h2, h3, p, table')).toHaveLength(0)
  await act(async () =>
    homeSearchBox().querySelector<HTMLButtonElement>('button[aria-label="검색 대상"]')!.click()
  )
  const options = [...document.querySelectorAll('[role="option"]')].map((item) => item.textContent)
  expect(options.toSorted()).toEqual(['전체', ...Object.values(CHARACTER_SERVER_NAMES)].toSorted())
  expect(searchRequests()).toEqual([])
})

it('시뮬레이터 검색 화면에서 이름을 제출하면 시뮬레이터 검색 주소에 남아 검색창 아래에 목록을 보이고, 줄을 그 캐릭터의 시뮬레이터 주소로 잇는다', async () => {
  serveCharacterSearch([candidateRow('시뮬', 'cain', 'simulator-1', 1000)])
  window.history.replaceState(null, '', '/simulator')
  await act(async () => root.render(<WebApp host={host} />))

  await searchName(' 시뮬 ', homeSearchBox())

  await waitForPath('/simulator')
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    characterName: '시뮬',
    serverId: 'all'
  })
  await vi.waitFor(() =>
    expect(searchResultRows()).toEqual([
      ['/c/cain/simulator-1/simulator', '카인시뮬크루세이더(남)1,000-1,000-']
    ])
  )
  const box = homeSearchBox()
  const list = container.querySelector('main section[aria-label="시뮬"]')!
  expect(box.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(container.querySelector('header form[role="search"]')).toBeNull()
})

it('시뮬레이터 검색 결과가 없으면 검색 화면과 같은 문구를 보인다', async () => {
  serveCharacterSearch([])
  window.history.replaceState(null, '', '/simulator?characterName=없는이름&serverId=all')
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(container.querySelector('main section p')?.textContent).toBe('캐릭터를 찾지 못했습니다.')
  )
  expect(container.querySelector('main section h2')?.textContent).toBe('없는이름')
})

it('메인 화면의 큰 검색창에서 모험단을 고르고 제출하면 그 모험단 대시보드로 간다', async () => {
  serveAdventure()
  window.history.replaceState(null, '', '/')
  await act(async () => root.render(<WebApp host={host} />))
  await chooseScope('모험단', homeSearchBox())

  await searchName('큰 모험단', homeSearchBox())

  await waitForPath(`/adventures/${encodeURIComponent('큰 모험단')}`)
  await vi.waitFor(() => expect(container.querySelector('main h1')?.textContent).toBe('큰 모험단'))
})

it('전역 검색창의 Alt+방향키와 글자 붙여넣기는 브라우저 기본 동작을 막지 않고 표의 자리와 회차 안내를 바꾸지 않는다', async () => {
  await act(async () => root.render(<WebApp host={host} />))
  const input = container.querySelector<HTMLInputElement>('header input[aria-label="캐릭터 이름"]')!
  const before = seats().map(nameOf)
  const status = await captureStatus()
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
  expect(await captureStatus()).toBe(status)
})

function summaryHeart(): HTMLButtonElement | null {
  return container.querySelector(
    'section[aria-label="캐릭터 요약"] button:is([aria-label="즐겨찾기에 더하기"], [aria-label="즐겨찾기 해제"])'
  )
}

function favoriteRows(): (string | null)[] {
  return [...container.querySelectorAll('section[aria-label="즐겨찾기한 캐릭터"] tbody tr')].map(
    (row) => row.querySelector('a')?.getAttribute('href') ?? null
  )
}

it('상세의 하트로 켠 즐겨찾기는 다시 열어도 켜져 있고, 즐겨찾기 화면에서 해제하면 목록에서 빠지고 상세의 하트도 꺼진다', async () => {
  serveDetail()
  window.history.replaceState(null, '', DETAIL_PATH)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() =>
    expect(summaryHeart()?.getAttribute('aria-label')).toBe('즐겨찾기에 더하기')
  )

  await act(async () => summaryHeart()!.click())

  expect(summaryHeart()?.getAttribute('aria-label')).toBe('즐겨찾기 해제')
  await act(async () => root.unmount())
  const savedText = localStorage.getItem('dfragon:favorite-characters') ?? ''
  useFavoriteCharacterStore.setState({ favoriteCharacters: [] })
  localStorage.setItem('dfragon:favorite-characters', savedText)
  await act(async () => useFavoriteCharacterStore.persist.rehydrate())
  root = createRoot(container)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() => expect(summaryHeart()?.getAttribute('aria-label')).toBe('즐겨찾기 해제'))

  await act(async () => root.unmount())
  window.history.pushState(null, '', '/favorites')
  root = createRoot(container)
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath('/favorites')
  expect(container.querySelector('main h1')).toBeNull()
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
    expect(summaryHeart()?.getAttribute('aria-label')).toBe('즐겨찾기에 더하기')
  )
})

function recentPopup(): HTMLElement | null {
  return document.querySelector('[aria-label="최근 본 캐릭터와 즐겨찾기"]')
}

it('상세를 연 캐릭터는 비어 있는 이름 칸에 초점이 가면 최근 본 캐릭터로 보이고, 이름을 쓰면 닫히며, 지우면 목록에서 빠진다', async () => {
  serveDetail()
  window.history.replaceState(null, '', DETAIL_PATH)
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() => expect(summaryHeart()).not.toBeNull())
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

it('예전 내 모험단 주소는 season과 함께 저장한 모험단 주소로 넘어가 그 시즌을 조회하고, 숫자가 아닌 season은 지금 시즌을 조회한다', async () => {
  useMyAdventureStore.setState({ adventureName: '합성 모험단' })
  server.use(
    http.get(`${SITE_API_URL}/adventures/:adventureName/*`, () =>
      HttpResponse.json({}, { status: 500 })
    )
  )
  const encodedName = encodeURIComponent('합성 모험단')
  const activityUrls = () =>
    requested.map(String).filter((url) => url.includes(`${encodedName}/activity`))

  window.history.replaceState(null, '', '/my?season=10')
  await act(async () => root.render(<WebApp host={host} />))
  await waitForPath(`/adventures/${encodedName}`)
  expect(window.location.search).toBe('?season=10')
  await vi.waitFor(() =>
    expect(activityUrls()).toEqual([`${SITE_API_URL}/adventures/${encodedName}/activity?season=10`])
  )
  await act(async () => root.unmount())

  root = createRoot(container)
  window.history.replaceState(null, '', '/my?season=abc')
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() =>
    expect(activityUrls()).toEqual([
      `${SITE_API_URL}/adventures/${encodedName}/activity?season=10`,
      `${SITE_API_URL}/adventures/${encodedName}/activity`
    ])
  )
})

it('저장한 모험단이 없으면 예전 내 모험단 주소는 모험단 이름 입력 화면으로 넘어가고, 이름을 넣고 보기를 누르면 그 모험단 주소로 가서 지금 시즌 활동과 주간 던파만 조회하고 이름은 브라우저에 남긴다', async () => {
  serveAdventure()
  window.history.replaceState(null, '', '/my')
  await act(async () => root.render(<WebApp host={host} />))

  await waitForPath('/adventures')
  expect(container.querySelector('main h1')?.textContent).toBe('모험단')
  expect(globalMenu()).toEqual([
    ['검색', null],
    ['통계', null],
    ['모험단', 'page'],
    ['장비 시뮬레이터', null]
  ])
  const form = container.querySelector<HTMLFormElement>('main form')!
  const input = form.querySelector<HTMLInputElement>('input[aria-label="모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      ' 합성 모험단 '
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => form.requestSubmit())

  const encodedName = encodeURIComponent('합성 모험단')
  await waitForPath(`/adventures/${encodedName}`)
  await vi.waitFor(() =>
    expect(container.querySelector('main section h2')?.textContent).toBe('합성 모험단')
  )
  expect(adventureRequests()).toEqual([
    `${SITE_API_URL}/adventures/${encodedName}/activity`,
    `${SITE_API_URL}/adventures/${encodedName}/weekly`
  ])
  expect(localStorage.getItem('dfragon:my-adventure')).toContain('합성 모험단')
})

const SET_STATS = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 4,
  equipmentSets: [
    { setId: '4ee7bd5912cda6e2a24c1f36d5202b46', name: '소울 페어리 세트', count: 3 },
    { setId: null, name: null, count: 1 }
  ],
  oathSets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      count: 4,
      options: [{ name: '용투 : 세계를 태우는 불꽃', count: 4 }]
    }
  ],
  combos: [
    { equipmentSetId: '4ee7bd5912cda6e2a24c1f36d5202b46', oathSetId: 16204, count: 3 },
    { equipmentSetId: null, oathSetId: 16204, count: 1 }
  ]
}

// 합성 스킬 통계다. 스킬 탭이 받을 응답 모양만 맞춘다.
const SKILL_STATS = {
  computedAt: '2026-11-18T15:38:47.900Z',
  minFame: null,
  sampleSize: 0,
  skills: [],
  evolutions: [],
  enhancements: [],
  chainSampleSize: 0,
  chains: []
}

const ITEM_STATS = {
  computedAt: '2026-11-18T15:38:47.900Z',
  sampleSize: 4,
  slots: [
    {
      slotId: 'WEAPON',
      items: [{ itemId: 'weapon-1', name: '합성 무기', typeDetail: null, count: 4 }]
    },
    {
      slotId: 'RING',
      items: [{ itemId: 'ring-1', name: '광휘를 머금은 눈동자', typeDetail: null, count: 3 }]
    }
  ]
}

function serveSetStats(): void {
  server.use(
    http.get(`${SITE_API_URL}/stats/sets`, () => HttpResponse.json(SET_STATS)),
    http.get(`${SITE_API_URL}/stats/items`, () => HttpResponse.json(ITEM_STATS)),
    http.get(`${SITE_API_URL}/rankings/fame`, () => HttpResponse.json({ characters: [] }))
  )
}

function setStatsRequests(): string[] {
  return requestedPaths('/stats/sets').map(({ search }) => search)
}

function rankingRequests(): URL[] {
  return requestedPaths('/rankings/fame')
}

it('세트, 조합, 무기 탭 사이를 오가면 고른 직업, 전직 필터를 주소에 그대로 둔다', async () => {
  serveSetStats()
  const [job] = RANKING_JOBS
  const [grow] = job!.grows
  const search = `?jobId=${job!.jobId}&jobGrowId=${grow!.jobGrowId}`
  window.history.replaceState(null, '', `/stats/sets${search}`)
  await act(async () => root.render(<WebApp host={host} />))

  const tab = (label: string) =>
    [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="통계 종류"] a')].find(
      (link) => link.textContent === label
    )!
  await vi.waitFor(() => expect(tab('조합')).toBeDefined())
  await act(async () => tab('조합').click())
  await waitForPath('/stats/combos')
  expect(window.location.search).toBe(search)

  await act(async () => tab('무기').click())
  await waitForPath('/stats/weapons')
  expect(window.location.search).toBe(search)
  expect(tab('캐릭터').getAttribute('href')).toBe('/stats')
})

it('무기 탭에서 스킬 탭으로 가면 직업, 전직 필터를 주소에 그대로 두고 표본 없이 그 전직의 스킬 통계를 받는다', async () => {
  serveSetStats()
  server.use(
    http.get(`${SITE_API_URL}/stats/skills`, () => HttpResponse.json(SKILL_STATS)),
    ...skillWindowHandlers([])
  )
  const [job] = RANKING_JOBS
  const [grow] = job!.grows
  const search = `?jobId=${job!.jobId}&jobGrowId=${grow!.jobGrowId}`
  window.history.replaceState(null, '', `/stats/weapons${search}`)
  await act(async () => root.render(<WebApp host={host} />))

  const skillTab = await vi.waitFor(() => {
    const link = [
      ...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="통계 종류"] a')
    ].find((candidate) => candidate.textContent === '스킬')
    expect(link).toBeDefined()

    return link!
  })
  await act(async () => skillTab.click())
  await waitForPath('/stats/skills')

  expect(window.location.search).toBe(search)
  await vi.waitFor(() =>
    expect(requestedPaths('/stats/skills').map(({ search }) => search)).toEqual([search])
  )
  const current = container.querySelector('nav[aria-label="통계 종류"] a[aria-current="page"]')
  expect(current?.textContent).toBe('스킬')
})

it('세트 통계 주소를 직접 열면 주소의 직업, 전직으로 통계를 받고, 전직을 고르면 주소를 바꿔 다시 받는다', async () => {
  serveSetStats()
  const [job] = RANKING_JOBS
  const [firstGrow, secondGrow] = job!.grows
  window.history.replaceState(
    null,
    '',
    `/stats/sets?jobId=${job!.jobId}&jobGrowId=${firstGrow!.jobGrowId}`
  )
  await act(async () => root.render(<WebApp host={host} />))

  await vi.waitFor(() =>
    expect(setStatsRequests()).toEqual([
      `?jobId=${job!.jobId}&jobGrowId=${firstGrow!.jobGrowId}&sample=all`
    ])
  )
  expect(globalMenu()).toContainEqual(['통계', 'page'])
  const statsTabs = [...container.querySelectorAll('nav[aria-label="통계 종류"] a')]
  expect(statsTabs.map((tab) => [tab.textContent, tab.getAttribute('aria-current')])).toEqual([
    ['세트', 'page'],
    ['무기', null],
    ['조합', null],
    ['캐릭터', null],
    ['스킬', null],
    ['클리어', null]
  ])

  const secondChip = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === secondGrow!.name
  )!
  await act(async () => secondChip.click())

  await vi.waitFor(() =>
    expect(new URLSearchParams(window.location.search).get('jobGrowId')).toBe(secondGrow!.jobGrowId)
  )
  await vi.waitFor(() =>
    expect(setStatsRequests().at(-1)).toBe(
      `?jobId=${job!.jobId}&jobGrowId=${secondGrow!.jobGrowId}&sample=all`
    )
  )
})

it.each([
  ['조합', '/stats/combos', '/stats/sets'],
  ['무기', '/stats/weapons', '/stats/items']
])(
  '%s 통계 주소를 직접 열면 그 탭을 고르고 주소의 직업으로 통계를 받는다',
  async (tab, path, api) => {
    serveSetStats()
    const [job] = RANKING_JOBS
    window.history.replaceState(null, '', `${path}?jobId=${job!.jobId}`)
    await act(async () => root.render(<WebApp host={host} />))

    await vi.waitFor(() =>
      expect(requestedPaths(api).map(({ search }) => search)).toEqual([
        `?jobId=${job!.jobId}&sample=all`
      ])
    )
    const current = container.querySelector('nav[aria-label="통계 종류"] a[aria-current="page"]')
    expect(current?.textContent).toBe(tab)
  }
)

it('세트 통계의 장비 세트 막대를 누르면 고른 직업과 그 세트로 거른 랭킹 주소로 가서 랭킹을 그 조건으로 받는다', async () => {
  serveSetStats()
  const [job] = RANKING_JOBS
  window.history.replaceState(null, '', `/stats/sets?jobId=${job!.jobId}`)
  await act(async () => root.render(<WebApp host={host} />))

  const equipmentBox = await vi.waitFor(() => {
    const box = container.querySelector('section[aria-label="장비 세트"]')
    expect(box?.querySelector('a')).not.toBeNull()

    return box!
  })
  const fairyLink = equipmentBox.querySelector<HTMLAnchorElement>('a')!
  expect(fairyLink.textContent).toContain('페어리')
  await act(async () => fairyLink.click())

  await waitForPath('/rankings')
  const search = new URLSearchParams(window.location.search)
  expect(Object.fromEntries(search)).toEqual({
    jobId: job!.jobId,
    equipmentSetId: '4ee7bd5912cda6e2a24c1f36d5202b46'
  })
  await vi.waitFor(() => {
    expect(
      rankingRequests().map(({ searchParams }) => Object.fromEntries(searchParams))
    ).toContainEqual({
      jobId: job!.jobId,
      equipmentSetId: '4ee7bd5912cda6e2a24c1f36d5202b46'
    })
  })
})

it('세트 통계의 무기 막대를 누르면 그 itemId로 거른 랭킹 주소로 가고, 새로 열어도 같은 아이템으로 랭킹을 받는다', async () => {
  serveSetStats()
  const [job] = RANKING_JOBS
  window.history.replaceState(null, '', `/stats/sets?jobId=${job!.jobId}`)
  await act(async () => root.render(<WebApp host={host} />))

  const weaponLink = await vi.waitFor(() => {
    const link = container.querySelector<HTMLAnchorElement>('section[aria-label="무기"] a')
    expect(link).not.toBeNull()

    return link!
  })
  await act(async () => weaponLink.click())
  await waitForPath('/rankings')
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    jobId: job!.jobId,
    itemIds: 'weapon-1'
  })

  await act(async () => root.unmount())
  root = createRoot(container)
  window.history.replaceState(
    null,
    '',
    `/rankings?itemIds=${encodeURIComponent('weapon-1,ring-1')}`
  )
  await act(async () => root.render(<WebApp host={host} />))
  await vi.waitFor(() => {
    expect(rankingRequests().map(({ searchParams }) => searchParams.get('itemIds'))).toContain(
      'weapon-1,ring-1'
    )
  })
})
