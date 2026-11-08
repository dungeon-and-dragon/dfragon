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
import { ClientHostContext } from '../hooks/useClientHost'
import { createTestClientHost } from '../testing/test-support/client-host'
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
  await act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost()}>
        <RouterProvider router={router} />
      </ClientHostContext>
    )
  )
}

function menu(): HTMLElement {
  return container.querySelector<HTMLElement>('nav[aria-label="전역 메뉴"]')!
}

function menuLinks(): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="전역 메뉴"] a')]
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
  expect(underline()).toEqual({ left: '90px', width: '75px', visibility: 'visible' })

  const adventures = menuLinks().find((link) => link.textContent === '모험단')!
  await act(async () => adventures.click())

  expect(adventures.getAttribute('aria-current')).toBe('page')
  expect(underlines()).toHaveLength(1)
  expect(underline()).toEqual({ left: '270px', width: '85px', visibility: 'visible' })
})

it('메뉴에 없는 화면에서는 밑줄을 숨기고, 메뉴 항목 화면으로 오면 그 항목 아래에 다시 보인다', async () => {
  await render('/characters/1/abc')

  expect(underline().visibility).toBe('hidden')

  await act(async () => router.navigate({ to: '/stats' }))

  expect(underline()).toEqual({ left: '180px', width: '80px', visibility: 'visible' })
})
