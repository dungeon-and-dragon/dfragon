// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useColorModeStore } from '../hooks/useColorModeStore'
import { ColorModeToggle } from './ColorModeToggle'

const STORAGE_KEY = 'dfragon:color-mode'

let root: Root
let container: HTMLDivElement
let systemDark: boolean
let systemSchemeChange: EventTarget

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  systemDark = true
  systemSchemeChange = new EventTarget()
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.assign(systemSchemeChange, {
      media: query,
      matches: query === '(prefers-color-scheme: dark)' && systemDark
    })
  )
  document.head.innerHTML = `
    <meta name="theme-color" data-color-mode="light" media="(prefers-color-scheme: light)" content="#fafafa" />
    <meta name="theme-color" data-color-mode="dark" media="(prefers-color-scheme: dark)" content="#101012" />
  `
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.head.innerHTML = ''
  delete document.documentElement.dataset.colorMode
  vi.unstubAllGlobals()
})

async function render(): Promise<void> {
  await act(async () => root.render(<ColorModeToggle />))
}

function button(): HTMLButtonElement {
  return container.querySelector('button')!
}

async function changeSystemScheme(dark: boolean): Promise<void> {
  systemDark = dark
  await act(async () => systemSchemeChange.dispatchEvent(new Event('change')))
}

function themeColorMedia(): Record<string, string> {
  const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]

  return Object.fromEntries(metas.map((meta) => [meta.dataset.colorMode, meta.media]))
}

describe('고른 모드가 없을 때', () => {
  it('시스템 설정의 반대 모드로 바꾸는 버튼이고, 시스템 설정이 바뀌면 따라 바뀐다', async () => {
    await render()
    expect(button().getAttribute('aria-label')).toBe('라이트 모드로 바꾸기')

    await changeSystemScheme(false)

    expect(button().getAttribute('aria-label')).toBe('다크 모드로 바꾸기')
    expect(document.documentElement.dataset.colorMode).toBeUndefined()
  })
})

describe('전환 버튼을 누르면', () => {
  it('고른 모드를 문서와 theme-color에 붙이고 브라우저에 저장한다', async () => {
    await render()

    await act(async () => button().click())

    expect(document.documentElement.dataset.colorMode).toBe('light')
    expect(themeColorMedia()).toEqual({ light: 'all', dark: 'not all' })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      state: { colorMode: 'light' },
      version: 1
    })
    expect(button().getAttribute('aria-label')).toBe('다크 모드로 바꾸기')
  })

  it('고른 모드는 시스템 설정이 바뀌어도 유지된다', async () => {
    await render()
    await act(async () => button().click())

    await changeSystemScheme(false)
    await changeSystemScheme(true)

    expect(button().getAttribute('aria-label')).toBe('다크 모드로 바꾸기')
  })
})

describe('브라우저에 저장된 모드', () => {
  it('다시 읽은 저장 모드를 시스템 설정보다 앞세워 버튼을 그린다', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { colorMode: 'light' }, version: 1 }))
    await useColorModeStore.persist.rehydrate()

    await render()

    expect(button().getAttribute('aria-label')).toBe('다크 모드로 바꾸기')
  })

  it.each([
    ['JSON이 아닌 값', 'light'],
    ['모드가 아닌 값', JSON.stringify({ state: { colorMode: 'blue' }, version: 1 })]
  ])('%s은 버리고 시스템 설정을 따른다', async (_name, stored) => {
    localStorage.setItem(STORAGE_KEY, stored)
    await useColorModeStore.persist.rehydrate()

    await render()

    expect(useColorModeStore.getState().colorMode).toBeNull()
    expect(button().getAttribute('aria-label')).toBe('라이트 모드로 바꾸기')
  })
})
