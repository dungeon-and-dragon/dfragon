// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GameTextLines, GameTextTone } from '@dfragon/client-core/shared/search/game-text'
import { GameText } from './GameText'
import { toneStyles } from './GameText.style'

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

async function render(lines: GameTextLines): Promise<void> {
  await act(async () => root.render(<GameText lines={lines} />))
}

function linesOf(): Element[] {
  return [...container.querySelectorAll('p > span')]
}

function classesOf(tone: GameTextTone): string[] {
  const { className } = stylex.props(toneStyles[tone])
  if (className === undefined) {
    throw new Error(`${tone} 색 class가 없다`)
  }

  return className.split(' ')
}

it('줄마다 block으로 나누고 빈 줄도 한 줄로 둔다', async () => {
  await render([
    [{ text: '[고원의 안개꽃]', tone: 'default' }],
    [],
    [{ text: '공격 범위 20% 증가', tone: 'default' }]
  ])

  expect(linesOf().map((line) => line.textContent)).toEqual([
    '[고원의 안개꽃]',
    '',
    '공격 범위 20% 증가'
  ])
})

it('조각마다 tone의 색을 칠한다', async () => {
  await render([
    [
      { text: '[황금의 왕]', tone: 'increase' },
      { text: ' [장비 발동 옵션]', tone: 'default' }
    ],
    [{ text: '최종 데미지 10% 증가', tone: 'rarity-epic' }],
    [{ text: '모든 속도 +25%', tone: 'rarity-primordial' }],
    [{ text: '[세트] 장착 시', tone: 'disabled' }]
  ])

  const segments = linesOf().map((line) => [...line.children])
  expect(segments.map((line) => line.map((segment) => segment.textContent))).toEqual([
    ['[황금의 왕]', ' [장비 발동 옵션]'],
    ['최종 데미지 10% 증가'],
    ['모든 속도 +25%'],
    ['[세트] 장착 시']
  ])
  const tones: GameTextTone[] = ['increase', 'rarity-epic', 'rarity-primordial', 'disabled']
  for (const [index, tone] of tones.entries()) {
    expect(segments[index]?.[0]?.className.split(' ')).toEqual(
      expect.arrayContaining(classesOf(tone))
    )
  }
  expect(segments[0]?.[1]?.className ?? '').toBe('')
})
