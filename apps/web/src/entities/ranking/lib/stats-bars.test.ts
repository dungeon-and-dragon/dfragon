import { expect, it } from 'vitest'
import type { CharacterStats } from '#entities/ranking/model/ranking-stats'
import { fameBars, shareText } from './stats-bars'

function statsOf(fameDistribution: CharacterStats['fameDistribution']): CharacterStats {
  return {
    computedAt: '2026-11-08T00:00:00.000Z',
    total: 0,
    servers: [],
    jobs: [],
    fameDistribution
  }
}

function bucketsOf(
  width: number,
  counts: Record<number, number>
): CharacterStats['fameDistribution'] {
  return Object.entries(counts).map(([from, count]) => ({
    from: Number(from),
    to: Number(from) + width,
    count
  }))
}

it('12만 미만 1천 구간은 0, 4만, 8만에서 시작하는 4만 막대 셋에 합친다', () => {
  const bars = fameBars(
    statsOf(bucketsOf(1_000, { 0: 1, 39_000: 2, 40_000: 30, 79_000: 4, 80_000: 500, 119_000: 6 }))
  )

  expect(bars.map(({ range, label, count, group }) => ({ range, label, count, group }))).toEqual([
    { range: '0~4만', label: '0', count: 3, group: 'coarse' },
    { range: '4만~8만', label: '4만', count: 34, group: 'coarse' },
    { range: '8만~12만', label: '8만', count: 506, group: 'coarse' }
  ])
})

it('12만부터 최고 구간까지 12만~13만과 13만 이상으로 나누고 응답에 없는 1천 구간은 0명 막대로 채우고 5천 배수에만 라벨을 단다', () => {
  const bars = fameBars(statsOf(bucketsOf(1_000, { 121_000: 7, 125_000: 8, 130_000: 9 })))

  expect(bars).toHaveLength(3 + 11)
  expect(
    bars
      .filter(({ group }) => group !== 'coarse')
      .map(({ range, label, count, group }) => [range, label, count, group])
  ).toEqual([
    ['12만~12.1만', '12만', 0, 'fine'],
    ['12.1만~12.2만', null, 7, 'fine'],
    ['12.2만~12.3만', null, 0, 'fine'],
    ['12.3만~12.4만', null, 0, 'fine'],
    ['12.4만~12.5만', null, 0, 'fine'],
    ['12.5만~12.6만', '12.5만', 8, 'fine'],
    ['12.6만~12.7만', null, 0, 'fine'],
    ['12.7만~12.8만', null, 0, 'fine'],
    ['12.8만~12.9만', null, 0, 'fine'],
    ['12.9만~13만', null, 0, 'fine'],
    ['13만~13.1만', '13만', 9, 'high']
  ])
})

it('12만 미만 캐릭터가 없어도 4만 막대 셋을 0명으로 둔다', () => {
  const bars = fameBars(statsOf(bucketsOf(1_000, { 120_000: 5 })))

  expect(bars.map(({ range, count, ratio }) => [range, count, ratio])).toEqual([
    ['0~4만', 0, 0],
    ['4만~8만', 0, 0],
    ['8만~12만', 0, 0],
    ['12만~12.1만', 5, 1]
  ])
})

it('높이 비율은 1천 명성당 인원이라 4만 막대는 인원을 40으로 나눠 1천 막대와 견준다', () => {
  const bars = fameBars(statsOf(bucketsOf(1_000, { 40_000: 4_000, 124_000: 200 })))

  expect(bars.map(({ range, ratio }) => [range, ratio])).toEqual([
    ['0~4만', 0],
    ['4만~8만', 0.5],
    ['8만~12만', 0],
    ['12만~12.1만', 0],
    ['12.1만~12.2만', 0],
    ['12.2만~12.3만', 0],
    ['12.3만~12.4만', 0],
    ['12.4만~12.5만', 1]
  ])
})

it('1만 단위 응답도 12만 미만은 4만 막대 셋으로 묶고 12만부터는 받은 구간 폭으로 그린다', () => {
  const bars = fameBars(
    statsOf(bucketsOf(10_000, { 30_000: 40, 70_000: 80, 80_000: 120, 120_000: 2_000, 140_000: 10 }))
  )

  expect(bars.map(({ range, label, count, ratio }) => [range, label, count, ratio])).toEqual([
    ['0~4만', '0', 40, 0.005],
    ['4만~8만', '4만', 80, 0.01],
    ['8만~12만', '8만', 120, 0.015],
    ['12만~13만', '12만', 2_000, 1],
    ['13만~14만', '13만', 0, 0],
    ['14만~15만', '14만', 10, 1]
  ])
})

it('13만 이상 막대는 13만 미만과 따로 자기 구간의 최대 인원을 높이 기준으로 삼는다', () => {
  const bars = fameBars(
    statsOf(bucketsOf(1_000, { 40_000: 4_000, 129_000: 400, 130_000: 20, 131_000: 10 }))
  )

  expect(bars.map(({ range, ratio }) => [range, ratio])).toEqual([
    ['0~4만', 0],
    ['4만~8만', 0.25],
    ['8만~12만', 0],
    ['12만~12.1만', 0],
    ['12.1만~12.2만', 0],
    ['12.2만~12.3만', 0],
    ['12.3만~12.4만', 0],
    ['12.4만~12.5만', 0],
    ['12.5만~12.6만', 0],
    ['12.6만~12.7만', 0],
    ['12.7만~12.8만', 0],
    ['12.8만~12.9만', 0],
    ['12.9만~13만', 1],
    ['13만~13.1만', 1],
    ['13.1만~13.2만', 0.5]
  ])
})

it('명성이 있는 캐릭터가 없으면 막대를 만들지 않는다', () => {
  expect(fameBars(statsOf([]))).toEqual([])
})

it('비율은 전체 캐릭터 수 대비 백분율을 소수 첫째 자리로 반올림해 적는다', () => {
  expect(shareText(1_078_455, 2_624_132)).toBe('41.1%')
  expect(shareText(2, 3)).toBe('66.7%')
  expect(shareText(2_624_132, 2_624_132)).toBe('100.0%')
  expect(shareText(0, 0)).toBe('0.0%')
})
