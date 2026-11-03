// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'

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

async function render(props: Partial<ComponentProps<typeof TopBar>> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <TopBar
        grade={85}
        nav={<nav aria-label="주 메뉴">내비</nav>}
        board={null}
        status={
          <button aria-label="화면 캡처, 창 감지됨">
            <span data-tone="success">창 감지됨</span>
          </button>
        }
        {...props}
      />
    )
  )
}

function textOrLabel(element: Element): string | null {
  const label = element.getAttribute('aria-label')
  if (label != null) {
    return label
  }

  return element.textContent
}

it('상단 바는 위 전역 바에 아이콘, 이름, 등급, 게임 연결 상태를, 아래 게임 바에 내비를 두고 테마, 카메라, 설정, 로그인 버튼은 없다', async () => {
  await render()
  const header = container.querySelector('header')!
  expect(container.querySelectorAll('header')).toHaveLength(1)
  const grade = header.querySelector('[role="img"]')!
  const name = [...header.querySelectorAll('span')].find((span) => span.textContent === '던삐삐')!
  expect(name).toBeDefined()
  const nav = header.querySelector('nav')!
  const status = header.querySelector('[data-tone]')!
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map(textOrLabel)).toEqual(['화면 캡처, 창 감지됨'])
  expect(header.querySelector('[aria-label$="테마"]')).toBeNull()
  expect(header.textContent).not.toContain('로그인')
  expect(header.querySelector('[aria-label="설정"]')).toBeNull()
  expect(header.querySelector('kbd')).toBeNull()
  const [globalBar, gameBar] = [...header.children]
  expect(header.children).toHaveLength(2)
  expect(globalBar.querySelector('img')?.getAttribute('alt')).toBe('')
  expect(globalBar.textContent).toContain('오늘 등급')
  expect([grade, name, status].every((item) => globalBar.contains(item))).toBe(true)
  expect(gameBar.contains(nav)).toBe(true)
  const items = [name, grade, status]
  for (let index = 1; index < items.length; index++) {
    expect(
      items[index - 1].compareDocumentPosition(items[index]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  }
})

it('보드 헤더 슬롯은 게임 바에서 내비 뒤에 두고 전역 바에는 두지 않는다', async () => {
  await render({ board: <div data-board="" /> })
  const header = container.querySelector('header')!
  const [globalBar, gameBar] = [...header.children]
  const nav = header.querySelector('nav')!
  const board = header.querySelector('[data-board]')!
  expect(gameBar.contains(board)).toBe(true)
  expect(globalBar.contains(board)).toBe(false)
  expect(nav.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
})

it('등급 퍼센트를 숫자와 희귀도 이름으로 보조 기술에 알린다', async () => {
  await render({ grade: 85 })
  const grade = container.querySelector('header [role="img"]')!

  expect(grade.textContent).toBe('85%')
  expect(grade.getAttribute('aria-label')).toBe('등급 85퍼센트, 언커먼')

  await render({ grade: 97 })

  expect(grade.textContent).toBe('97%')
  expect(grade.getAttribute('aria-label')).toBe('등급 97퍼센트, 태초')
})

it('등급을 받지 못하면 퍼센트 자리를 -%로 비우고 이름은 그대로 둔다', async () => {
  await render({ grade: null })
  const header = container.querySelector('header')!
  const grade = header.querySelector('[role="img"]')!

  expect(grade.textContent).toBe('-%')
  expect(grade.getAttribute('aria-label')).toBe('등급 정보 없음')
  expect(header.textContent).toContain('던삐삐')
})
