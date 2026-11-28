// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  type AnyRouter,
  RouterProvider
} from '@tanstack/react-router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { server } from '#testing/test-support/msw-server'
import { todayGradeHandlers } from '#widgets/global-bar/api/today-grade.handlers'
import { GlobalBar } from './GlobalBar'

const MENU_LEFT = 100

let root: Root
let container: HTMLDivElement
let router: AnyRouter

// jsdom에는 layout이 없어, 메뉴 항목마다 다른 위치와 폭을 돌려준다.
function stubMenuLayout(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.matches('nav[aria-label="전역 메뉴"]')) {
      return new DOMRect(MENU_LEFT, 0, 600, 48)
    }
    const index = menuLinks().indexOf(this as HTMLAnchorElement)
    if (index >= 0) {
      return new DOMRect(MENU_LEFT + index * 90, 0, 70 + index * 5, 48)
    }

    return new DOMRect()
  })
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('scrollTo', vi.fn())
  stubMenuLayout()
  server.use(todayGradeHandlers.grade(85))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function render(path: string): Promise<void> {
  router = createRouter({
    routeTree: createRootRoute({ component: GlobalBar, notFoundComponent: () => null }),
    history: createMemoryHistory({ initialEntries: [path] })
  })
  await act(async () => root.render(<RouterProvider router={router} />))
}

function menu(): HTMLElement {
  return container.querySelector<HTMLElement>('nav[aria-label="전역 메뉴"]')!
}

function menuLinks(): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="전역 메뉴"] a')]
}

function currentLabels(): (string | null)[] {
  return menuLinks()
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent)
}

function underlines(): HTMLElement[] {
  return [...menu().querySelectorAll<HTMLElement>('[aria-hidden="true"]')]
}

function underline(): { left: string; width: string; visibility: string } {
  const [element] = underlines()

  return {
    left: element.style.left,
    width: element.style.width,
    visibility: element.style.visibility
  }
}

it('지금 항목이 바뀌면 메뉴의 밑줄 하나가 새 항목 아래로 옮겨진다', async () => {
  await render('/rankings')

  expect(underlines()).toHaveLength(1)
  expect(underline()).toEqual({ left: '0px', width: '70px', visibility: 'visible' })

  const adventures = menuLinks().find((link) => link.textContent === '모험단')!
  await act(async () => adventures.click())

  expect(adventures.getAttribute('aria-current')).toBe('page')
  expect(underlines()).toHaveLength(1)
  expect(underline()).toEqual({ left: '180px', width: '80px', visibility: 'visible' })
})

it('메뉴에 없는 화면에서는 밑줄을 숨기고, 메뉴 항목 화면으로 오면 그 항목 아래에 다시 보인다', async () => {
  await render('/characters/1/abc')

  expect(underline().visibility).toBe('hidden')

  await act(async () => router.navigate({ to: '/stats' }))

  expect(underline()).toEqual({ left: '90px', width: '75px', visibility: 'visible' })
})

it('클리어 집계 주소에서는 통계 메뉴를 현재 화면으로 표시한다', async () => {
  await render('/clears')

  const stats = menuLinks().find((link) => link.textContent === '통계')!
  expect(stats.getAttribute('aria-current')).toBe('page')
  expect(menuLinks().map((link) => link.textContent)).not.toContain('클리어')
})

it('메인 화면에서는 검색창과 메뉴 밑줄을 숨기고, 다른 화면으로 가면 검색창을 다시 보인다', async () => {
  await render('/')

  expect(container.querySelector('form[role="search"]')).toBeNull()
  expect(menuLinks().map((link) => link.getAttribute('aria-current'))).toEqual([
    null,
    null,
    null,
    null,
    null
  ])
  expect(underline().visibility).toBe('hidden')

  await act(async () => router.navigate({ to: '/rankings' }))

  expect(container.querySelector('form[role="search"]')).not.toBeNull()
})

it('통계는 직업 통계 주소로, 메뉴 끝의 장비 시뮬레이터는 시뮬레이터 검색 주소로, 실험실은 마법부여 주소로 가고, 메뉴에 즐겨찾기 항목은 없다', async () => {
  await render('/rankings')

  expect(menuLinks().map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['검색', '/rankings'],
    ['통계', '/stats/jobs'],
    ['모험단', '/adventures'],
    ['장비 시뮬레이터', '/simulator'],
    ['실험실', '/lab/enchants']
  ])
})

it('시뮬레이터 검색 주소에서는 장비 시뮬레이터를 지금 항목으로 두고 전역 바의 검색창을 숨긴다', async () => {
  await render('/simulator?characterName=합성&serverId=all')

  expect(currentLabels()).toEqual(['장비 시뮬레이터'])
  expect(container.querySelector('form[role="search"]')).toBeNull()
})

it('캐릭터의 시뮬레이터 주소에서도 장비 시뮬레이터를 지금 항목으로 두고 검색창은 보인다', async () => {
  await render('/c/cain/character-1/simulator')

  expect(currentLabels()).toEqual(['장비 시뮬레이터'])
  expect(container.querySelector('form[role="search"]')).not.toBeNull()
})

it('캐릭터 상세 주소에서는 장비 시뮬레이터를 지금 항목으로 두지 않는다', async () => {
  await render('/c/cain/character-1')

  expect(currentLabels()).toEqual([])
})

it.each(['/lab/enchants', '/lab/multisearch'])(
  '실험실 아래 주소(%s)에서는 실험실을 지금 항목으로 두고 멀티서치 항목은 메뉴에 없다',
  async (path) => {
    await render(path)

    expect(menuLinks().map((link) => link.textContent)).not.toContain('멀티서치')
    expect(currentLabels()).toEqual(['실험실'])
  }
)
