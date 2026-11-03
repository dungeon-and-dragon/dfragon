// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NameField, type NameFieldProps } from './NameField'

// jsdom은 테두리 색을 계산하지 않으므로 같은 선언에서 나온 class를 칸이 가졌는지로 확인한다.
const vacantBorder = stylex.create({
  strong: { borderColor: { default: colors.borderStrong, ':focus': colors.signal } }
})
const vacantClasses = stylex.props(vacantBorder.strong).className!.split(' ')

let root: Root
let container: HTMLElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function render(props: Partial<NameFieldProps> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <NameField aria-label="2번 캐릭터 이름" value="이름" onChange={vi.fn()} {...props} />
    )
  )
}

const input = (): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('[aria-label="2번 캐릭터 이름"]')!

it('일반 input props를 안쪽 input에 그대로 넘기고 placeholder를 두지 않는다', async () => {
  const onChange = vi.fn()
  const onFocus = vi.fn()
  const onBlur = vi.fn()
  const onKeyDown = vi.fn()
  await render({ value: '새이름', onChange, onFocus, onBlur, onKeyDown })
  expect(input().value).toBe('새이름')
  expect(input().hasAttribute('placeholder')).toBe(false)
  await act(async () => {
    input().focus()
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), '바뀜')
    input().dispatchEvent(new Event('input', { bubbles: true }))
    input().blur()
  })
  expect(onFocus).toHaveBeenCalledOnce()
  expect(onKeyDown).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledOnce()
  expect(onBlur).toHaveBeenCalledOnce()
})

it('빈 자리 칸에만 늘 보이는 테두리를 둔다', async () => {
  const hasVacantBorder = (): boolean =>
    vacantClasses.every((name) => input().classList.contains(name))

  await render()
  expect(hasVacantBorder()).toBe(false)
  await render({ vacant: true })
  expect(hasVacantBorder()).toBe(true)
})
