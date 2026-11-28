// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TestRouter } from '#testing/test-support/test-router'
import { type Bar, RowBars } from './RowBars'

let container: HTMLDivElement
let root: Root

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

const bars: Bar[] = [
  { key: 'cain', name: '카인', value: 600, share: '60.0%' },
  { key: 'bakal', name: '바칼', value: 300, share: '30.0%' }
]

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <TestRouter>
        <RowBars bars={bars} />
      </TestRouter>
    )
  )
  await vi.waitFor(() => expect(container.querySelector('ul')).not.toBeNull())
}

function tooltipText(): string | null {
  const tooltip = container.querySelector<HTMLElement>('ul + [aria-hidden="true"]')!
  if (tooltip.style.visibility === 'hidden') {
    return null
  }

  return tooltip.textContent
}

function moveMouse(from: Element, to: Element): Promise<void> {
  return act(async () => {
    from.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: to }))
    to.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: from }))
  })
}

it('행에 마우스를 올리면 그 행의 비율을 띄우고 목록을 벗어나면 지운다', async () => {
  await render()

  const row = container.querySelector('li')!
  expect(tooltipText()).toBeNull()

  await moveMouse(document.body, row)
  expect(tooltipText()).toBe('60.0%')

  await moveMouse(row, document.body)
  expect(tooltipText()).toBeNull()
})

it('행 사이 간격을 지나도 비율 툴팁을 닫지 않고 다음 행의 비율로 바꾼다', async () => {
  await render()

  const list = container.querySelector('ul')!
  const [firstRow, secondRow] = [...list.querySelectorAll('li')]
  await moveMouse(document.body, firstRow!)
  await moveMouse(firstRow!, list)
  expect(tooltipText()).toBe('60.0%')

  await moveMouse(list, secondRow!)
  expect(tooltipText()).toBe('30.0%')

  await moveMouse(secondRow!, document.body)
  expect(tooltipText()).toBeNull()
})
