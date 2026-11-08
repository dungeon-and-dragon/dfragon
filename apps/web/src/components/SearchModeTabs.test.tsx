// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import type { SearchMode } from '#core/capture/search-mode'
import { SearchModeTabs } from './SearchModeTabs'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(searchMode: SearchMode): Promise<void> {
  useSearchModeStore.setState({ searchMode })
  await act(async () => root.render(<SearchModeTabs />))
}

function tabs(): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="화면"] [role="tab"]')
  ]
}

function selection(): [string | null, string | null][] {
  return tabs().map((tab) => [tab.textContent, tab.getAttribute('aria-selected')])
}

it('파티와 공대 탭 두 개를 두고 지금 화면의 탭을 고른 것으로 표시한다', async () => {
  await render('raid')

  expect(selection()).toEqual([
    ['파티', 'false'],
    ['공대', 'true']
  ])
})

it('탭을 누르면 검색 모드를 그 화면으로 바꾼다', async () => {
  await render('party')

  await act(async () => tabs()[1].click())

  expect(useSearchModeStore.getState().searchMode).toBe('raid')
  expect(selection()).toEqual([
    ['파티', 'false'],
    ['공대', 'true']
  ])

  await act(async () => tabs()[0].click())

  expect(useSearchModeStore.getState().searchMode).toBe('party')
})
