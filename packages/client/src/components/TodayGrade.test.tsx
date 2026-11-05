// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TodayGrade } from './TodayGrade'

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

async function render(grade: number | null): Promise<void> {
  await act(async () => root.render(<TodayGrade grade={grade} />))
}

it('라벨 글자 없이 퍼센트만 보이고 보조 기술에는 오늘 등급, 숫자, 희귀도 이름으로 알린다', async () => {
  await render(85)
  const grade = container.querySelector('[role="img"]')!

  expect(container.textContent).toBe('85%')
  expect(grade.getAttribute('aria-label')).toBe('오늘 등급 85퍼센트, 언커먼')

  await render(97)

  expect(grade.textContent).toBe('97%')
  expect(grade.getAttribute('aria-label')).toBe('오늘 등급 97퍼센트, 태초')
})

it('등급을 받지 못하면 퍼센트 자리를 -%로 비운다', async () => {
  await render(null)
  const grade = container.querySelector('[role="img"]')!

  expect(grade.textContent).toBe('-%')
  expect(grade.getAttribute('aria-label')).toBe('오늘 등급 정보 없음')
})
