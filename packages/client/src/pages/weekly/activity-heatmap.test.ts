import { describe, expect, it } from 'vitest'
import {
  type ActivityDay,
  buildHeatmapWeeks,
  type HeatmapDay,
  heatLevel,
  levelThresholds,
  ringHighlight
} from './activity-heatmap'

// 시즌 시작은 목요일 06:00 KST(전날 21:00 UTC)다.
const SEASON_START = '2026-03-25T21:00:00.000Z'

function dates(days: readonly HeatmapDay[]): (string | null)[] {
  return days.map((day) => (day.state === 'outside' ? null : day.date))
}

function day(overrides: Partial<ActivityDay>): ActivityDay {
  return {
    date: '2026-04-02',
    raid: 0,
    legion: 0,
    item: 0,
    enhance: 0,
    primeval: false,
    mythic: false,
    highEnhancement: false,
    ...overrides
  }
}

describe('buildHeatmapWeeks', () => {
  it('목요일에 시작한 시즌은 첫 열이 시작일부터 수요일까지 7일이다', () => {
    const weeks = buildHeatmapWeeks(
      { id: 11, startsAt: SEASON_START, endsAt: null },
      Date.parse('2026-04-08T21:00:00.000Z')
    )

    expect(weeks).toHaveLength(3)
    expect(dates(weeks[0].days)).toEqual([
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01'
    ])
    expect(weeks[2].days[0]).toEqual({ state: 'day', date: '2026-04-09', today: true })
  })

  it('지금 시즌의 마지막 열에서 오늘 뒤의 날은 아직 오지 않은 날이다', () => {
    const weeks = buildHeatmapWeeks(
      { id: 11, startsAt: SEASON_START, endsAt: null },
      Date.parse('2026-03-28T03:00:00.000Z')
    )

    expect(weeks).toHaveLength(1)
    expect(weeks[0].days.map((cell) => cell.state)).toEqual([
      'day',
      'day',
      'day',
      'future',
      'future',
      'future',
      'future'
    ])
    expect(weeks[0].days[2]).toEqual({ state: 'day', date: '2026-03-28', today: true })
  })

  it('06:00 KST 전 시각은 전날에 속한다', () => {
    const beforeReset = buildHeatmapWeeks(
      { id: 11, startsAt: SEASON_START, endsAt: null },
      Date.parse('2026-03-27T20:59:59.000Z')
    )
    const afterReset = buildHeatmapWeeks(
      { id: 11, startsAt: SEASON_START, endsAt: null },
      Date.parse('2026-03-27T21:00:00.000Z')
    )

    expect(beforeReset[0].days[1]).toEqual({ state: 'day', date: '2026-03-27', today: true })
    expect(afterReset[0].days[2]).toEqual({ state: 'day', date: '2026-03-28', today: true })
  })

  it('목요일이 아닌 날 시작한 시즌은 그 주 목요일 열에 놓고 시작 전 날은 비운다', () => {
    const weeks = buildHeatmapWeeks(
      { id: 11, startsAt: '2026-03-27T21:00:00.000Z', endsAt: null },
      Date.parse('2026-03-28T03:00:00.000Z')
    )

    expect(dates(weeks[0].days)).toEqual([
      null,
      null,
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01'
    ])
  })

  it('끝난 시즌은 다음 시즌 시작 전날까지만 칸을 두고 오늘을 표시하지 않는다', () => {
    const weeks = buildHeatmapWeeks(
      { id: 10, startsAt: SEASON_START, endsAt: '2026-04-04T21:00:00.000Z' },
      Date.parse('2026-11-07T03:00:00.000Z')
    )

    expect(weeks).toHaveLength(2)
    expect(dates(weeks[1].days)).toEqual([
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
      null,
      null,
      null,
      null
    ])
    expect(
      weeks.flatMap((week) => week.days).some((cell) => cell.state === 'day' && cell.today)
    ).toBe(false)
  })

  it('주에 1일이 들어 있는 열에만 그 달을 붙인다', () => {
    const weeks = buildHeatmapWeeks(
      { id: 11, startsAt: SEASON_START, endsAt: null },
      Date.parse('2026-05-08T03:00:00.000Z')
    )

    expect(weeks.map(({ month }) => month)).toEqual([
      4,
      undefined,
      undefined,
      undefined,
      undefined,
      5,
      undefined
    ])
  })
})

describe('levelThresholds, heatLevel', () => {
  it('활동한 날의 횟수를 사분위로 나눠 적은 날부터 1~4단계를 준다', () => {
    const thresholds = levelThresholds([0, 4, 1, 3, 2])

    expect([0, 1, 2, 3, 4].map((count) => heatLevel(count, thresholds))).toEqual([0, 1, 2, 3, 4])
    expect(thresholds.at(-1)).toBe(4)
  })

  it('경계보다 많은 날은 가장 높은 단계다', () => {
    const thresholds = levelThresholds([1, 2, 3, 4])

    expect(heatLevel(40, thresholds)).toBe(4)
  })

  it('활동한 날의 횟수가 모두 같으면 모두 가장 높은 단계다', () => {
    const thresholds = levelThresholds([5, 5, 5])

    expect(heatLevel(5, thresholds)).toBe(4)
  })

  it('활동한 날이 없으면 경계가 없고 0회는 0단계다', () => {
    expect(levelThresholds([0, 0])).toEqual([])
    expect(heatLevel(0, [])).toBe(0)
  })
})

describe('ringHighlight', () => {
  it('아이템은 신화를 얻은 날 신화, 태초만 얻은 날 태초 테두리다', () => {
    expect(ringHighlight(day({ item: 3, primeval: true, mythic: true }), 'item')).toBe('mythic')
    expect(ringHighlight(day({ item: 3, primeval: true }), 'item')).toBe('primeval')
    expect(ringHighlight(day({ item: 3 }), 'item')).toBeUndefined()
  })

  it('강화는 10증폭 이상이나 12강 이상을 도전한 날 태초 테두리다', () => {
    expect(ringHighlight(day({ enhance: 2, highEnhancement: true }), 'enhance')).toBe('primeval')
    expect(ringHighlight(day({ enhance: 2 }), 'enhance')).toBeUndefined()
  })

  it('전체, 레이드, 레기온은 특별한 날이어도 테두리가 없다', () => {
    const special = day({
      raid: 1,
      item: 1,
      enhance: 1,
      primeval: true,
      mythic: true,
      highEnhancement: true
    })

    expect(
      (['all', 'raid', 'legion'] as const).map((kind) => ringHighlight(special, kind))
    ).toEqual([undefined, undefined, undefined])
  })
})
