// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  type SkillAdoptionTarget,
  type SkillStats,
  skillAdoptionOf
} from '#core/ranking/skill-stats'
import type { SkillMarks } from '#core/catalog/skill-window'
import type { MaleCrusaderRole } from '#core/character/male-crusader'
import { SkillAdoptionTooltip } from './SkillAdoptionTooltip'

const MARKS: SkillMarks = {
  evolution: [
    'https://skilltab.test/marks/evolution-1.png',
    'https://skilltab.test/marks/evolution-2.png'
  ],
  enhancement: [
    'https://skilltab.test/marks/enhancement-1.png',
    'https://skilltab.test/marks/enhancement-2.png'
  ]
}

// 합성 집계다. 스킬, 갈래 이름은 응답 형태만 맞춘 값이다.
const STATS: SkillStats = {
  computedAt: '2026-11-06T15:00:00.000Z',
  minFame: 70000,
  sampleSize: 2316,
  skills: [
    {
      name: '참수',
      learned: 1010,
      levels: [
        [1, 400],
        [41, 550],
        [50, 60]
      ]
    }
  ],
  evolutions: [{ name: '참수', type1: 616, type2: 381 }],
  enhancements: [{ name: '참수', type1: 480, type2: 495 }]
}

const NOW = Date.parse('2026-11-07T12:00:00+09:00')

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

async function renderTooltip(
  target: SkillAdoptionTarget,
  role: MaleCrusaderRole | null = null
): Promise<void> {
  const adoption = skillAdoptionOf(STATS, target)
  if (adoption === null) {
    throw new Error('합성 집계의 표본이 20명보다 적다')
  }
  await act(async () =>
    root.render(
      <SkillAdoptionTooltip
        name={target.name}
        adoption={adoption}
        role={role}
        marks={MARKS}
        now={NOW}
      />
    )
  )
}

function lines(): string[] {
  return [...(container.firstElementChild?.children ?? [])].map((line) => {
    if (line.children.length > 0) {
      return [...line.children].map((cell) => cell.textContent).join(' ')
    }

    const text = line.textContent ?? ''

    return text
  })
}

it('채택률, 레벨 상위 50%와 5%, 개화와 강화 비율, 표본과 기준 시각을 줄마다 보인다', async () => {
  await renderTooltip({ name: '참수', evolutionNames: ['단죄', '처형'], hasEnhancement: true })

  expect(lines()).toEqual([
    '참수',
    '채택률 43.6%',
    '레벨',
    '상위 50% 41 상위 5% 50',
    '개화',
    '단죄 61.0% 처형 37.7%',
    '강화',
    '데미지 47.5% 쿨타임 감소 49.0%',
    '표본 2,316명 11-07 00:00'
  ])
  expect([...container.querySelectorAll('img')].map((mark) => mark.getAttribute('src'))).toEqual([
    ...MARKS.evolution,
    ...MARKS.enhancement
  ])
})

it('개화, 강화가 없는 스킬은 그 줄을 두지 않는다', async () => {
  await renderTooltip({ name: '참수', evolutionNames: null, hasEnhancement: false })

  expect(lines()).toEqual([
    '참수',
    '채택률 43.6%',
    '레벨',
    '상위 50% 41 상위 5% 50',
    '표본 2,316명 11-07 00:00'
  ])
})

it('남성 크루세이더의 역할 표본이면 표본 수 앞에 역할을 쓴다', async () => {
  await renderTooltip({ name: '참수', evolutionNames: null, hasEnhancement: false }, 'dealer')
  expect(lines().at(-1)).toBe('딜러 표본 2,316명 11-07 00:00')

  await renderTooltip({ name: '참수', evolutionNames: null, hasEnhancement: false }, 'buffer')
  expect(lines().at(-1)).toBe('버퍼 표본 2,316명 11-07 00:00')
})
