// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { type SkillAdoptionTarget, type SkillStats, skillAdoptionOf } from '#entities/ranking'
import type { SkillMarks } from '#entities/catalog'
import type { MaleCrusaderRole } from '#entities/character'
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

const BEHEAD = { name: '참수', level: 41, maxLevel: 50 } as const

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
  role: MaleCrusaderRole | null = null,
  stats: SkillStats = STATS
): Promise<void> {
  const adoption = skillAdoptionOf(stats, target)
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
  const shown = [...(container.firstElementChild?.children ?? [])].filter(
    (line) => !line.hasAttribute('aria-hidden')
  )

  return shown.map((line) => {
    if (line.children.length > 0) {
      return [...line.children].map((cell) => cell.textContent).join(' ')
    }

    const text = line.textContent ?? ''

    return text
  })
}

it('채택률, 레벨 축과 많이 찍은 레벨 3개, 개화와 강화 비율, 표본과 기준 시각을 줄마다 보인다', async () => {
  await renderTooltip({ ...BEHEAD, evolutionNames: ['단죄', '처형'], hasEnhancement: true })

  expect(lines()).toEqual([
    '참수',
    '채택률 43.6%',
    '레벨',
    '1 50',
    'Lv41 54.5% Lv1 39.6% Lv50 5.9%',
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

function linePoints(): [number, number][] {
  const points = container.querySelector('polyline')?.getAttribute('points') ?? ''

  return points.split(' ').map((point) => {
    const [x = Number.NaN, y = Number.NaN] = point.split(',').map(Number)

    return [x, y]
  })
}

it('1레벨부터 최대 레벨까지 레벨마다 점을 이어 가장 많은 레벨을 맨 위에 두고, 이 캐릭터 레벨에 점을 찍는다', async () => {
  await renderTooltip({ ...BEHEAD, evolutionNames: null, hasEnhancement: false })

  const points = linePoints()
  expect(points).toHaveLength(50)
  expect(points[0]).toEqual([0, expect.closeTo(40 * (1 - 400 / 550), 6)])
  expect(points[1]).toEqual([expect.closeTo(100 / 49, 6), 40])
  expect(points[40]).toEqual([expect.closeTo(4000 / 49, 6), 0])
  expect(points[49]).toEqual([100, expect.closeTo(40 * (1 - 60 / 550), 6)])

  const dot = container.querySelector<HTMLElement>('[data-current-level]')
  expect(Number.parseFloat(dot?.style.left ?? '')).toBeCloseTo(4000 / 49, 6)
  expect(dot?.style.bottom).toBe('100%')
})

it('이 캐릭터가 배우지 않은 스킬은 점을 두지 않는다', async () => {
  await renderTooltip({ ...BEHEAD, level: null, evolutionNames: null, hasEnhancement: false })

  expect(linePoints()).toHaveLength(50)
  expect(container.querySelector('[data-current-level]')).toBeNull()
  expect(lines()).toEqual([
    '참수',
    '채택률 43.6%',
    '레벨',
    '1 50',
    'Lv41 54.5% Lv1 39.6% Lv50 5.9%',
    '표본 2,316명 11-07 00:00'
  ])
})

it('집계 시각이 null이면 표본은 표시하고 시각은 표시하지 않는다', async () => {
  await renderTooltip({ ...BEHEAD, evolutionNames: null, hasEnhancement: false }, null, {
    ...STATS,
    computedAt: null
  })

  expect(lines()).toEqual([
    '참수',
    '채택률 43.6%',
    '레벨',
    '1 50',
    'Lv41 54.5% Lv1 39.6% Lv50 5.9%',
    '표본 2,316명'
  ])
})

it('개화, 강화가 없는 스킬은 그 줄을 두지 않는다', async () => {
  await renderTooltip({ ...BEHEAD, evolutionNames: null, hasEnhancement: false })

  expect(lines()).toEqual([
    '참수',
    '채택률 43.6%',
    '레벨',
    '1 50',
    'Lv41 54.5% Lv1 39.6% Lv50 5.9%',
    '표본 2,316명 11-07 00:00'
  ])
})

it('남성 크루세이더의 역할 표본이면 표본 수 앞에 역할을 쓴다', async () => {
  await renderTooltip({ ...BEHEAD, evolutionNames: null, hasEnhancement: false }, 'dealer')
  expect(lines().at(-1)).toBe('딜러 표본 2,316명 11-07 00:00')

  await renderTooltip({ ...BEHEAD, evolutionNames: null, hasEnhancement: false }, 'buffer')
  expect(lines().at(-1)).toBe('버퍼 표본 2,316명 11-07 00:00')
})
