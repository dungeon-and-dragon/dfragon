import { describe, expect, it } from 'vitest'
import {
  alignedScale,
  boxPlotScale,
  definedRuns,
  lastDefined,
  niceScale,
  splitLabelShown,
  stackPieces
} from './chart-geometry'

describe('niceScale', () => {
  it('0부터 최댓값을 덮는 1, 2, 2.5, 5 단위 눈금을 만든다', () => {
    expect(niceScale(0, 63.4, 7).ticks).toEqual([0, 10, 20, 30, 40, 50, 60, 70])
    expect(niceScale(0, 57120, 3).ticks).toEqual([0, 20000, 40000, 60000])
    expect(niceScale(0, 9, 4).ticks).toEqual([0, 2.5, 5, 7.5, 10])
    expect(niceScale(0, 18, 4).ticks).toEqual([0, 5, 10, 15, 20])
    expect(niceScale(0, 4.2, 4).ticks).toEqual([0, 2, 4, 6])
  })

  it('최솟값이 0이 아니면 그 아래 눈금에서 시작한다', () => {
    const scale = niceScale(104292, 136880, 4)
    const [first = 0, second = 0] = scale.ticks

    expect(scale.min).toBeLessThanOrEqual(104292)
    expect(scale.max).toBeGreaterThanOrEqual(136880)
    expect(second - first).toBe(10000)
  })

  it('값이 모두 0이어도 높이가 있는 축을 만든다', () => {
    const scale = niceScale(0, 0, 4)

    expect(scale.max).toBeGreaterThan(0)
  })
})

it('alignedScale은 왼쪽 축과 같은 칸 수로 오른쪽 축을 나눈다', () => {
  expect(alignedScale(13.4, 3).ticks).toEqual([0, 5, 10, 15])
})

it('definedRuns는 값이 없는 칸에서 선을 끊는다', () => {
  expect(definedRuns([1, 2, null, null, 5, 6, null])).toEqual([
    [
      { index: 0, value: 1 },
      { index: 1, value: 2 }
    ],
    [
      { index: 4, value: 5 },
      { index: 5, value: 6 }
    ]
  ])
  expect(definedRuns([null, null])).toEqual([])
})

it('lastDefined는 끝에 값이 없어도 마지막으로 값이 있는 칸을 준다', () => {
  expect(lastDefined([1, null, 3, null])).toEqual({ index: 2, value: 3 })
  expect(lastDefined([null])).toBeUndefined()
})

it('stackPieces는 값이 있는 맨 위 조각만 위쪽으로 표시한다', () => {
  expect(stackPieces([30, 10, 0])).toEqual([
    { from: 0, to: 30, top: false },
    { from: 30, to: 40, top: true },
    { from: 40, to: 40, top: false }
  ])
})

it('splitLabelShown은 전체의 12%부터 값을 적는다', () => {
  expect(splitLabelShown(12, 100)).toBe(true)
  expect(splitLabelShown(11.9, 100)).toBe(false)
  expect(splitLabelShown(0, 0)).toBe(false)
})

it('boxPlotScale은 모든 줄의 5%부터 최고값까지 덮고 줄이 없으면 축을 만들지 않는다', () => {
  const scale = boxPlotScale([
    { p5: 110000, p25: 120000, median: 124000, p75: 128000, p95: 132000, max: 136500 },
    { p5: 104500, p25: 118000, median: 122000, p75: 126000, p95: 131000, max: 135000 }
  ])

  expect(scale?.min).toBeLessThanOrEqual(104500)
  expect(scale?.max).toBeGreaterThanOrEqual(136500)
  expect(boxPlotScale([])).toBeUndefined()
})
