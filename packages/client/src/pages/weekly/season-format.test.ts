import { describe, expect, it } from 'vitest'
import { seasonPeriod } from './season-format'

const MARGYE = '2016-08-31T21:00:00.000Z'
const HAREM = '2018-08-08T21:00:00.000Z'
const CHEONHAECHEON = '2026-03-25T21:00:00.000Z'
const NOW = Date.parse('2026-11-08T03:00:00.000Z')

describe('seasonPeriod', () => {
  it('끝난 시즌은 다음 시즌 시작일 하루 전까지 세어 끝 날짜와 일수를 낸다', () => {
    expect(seasonPeriod(MARGYE, HAREM, NOW)).toEqual({
      range: '2016.09.01 ~ 2018.08.08',
      days: 707
    })
    expect(seasonPeriod(HAREM, '2020-01-08T21:00:00.000Z', NOW).range).toBe(
      '2018.08.09 ~ 2020.01.08'
    )
  })

  it('다음 시즌이 없으면 끝 날짜 없이 시작일부터 오늘(KST)까지 센다', () => {
    expect(seasonPeriod(CHEONHAECHEON, undefined, NOW)).toEqual({
      range: '2026.03.26 ~',
      days: 228
    })
  })

  it('시작 당일은 1일이고, KST 자정을 넘기면 다음 날로 센다', () => {
    const startedAt = Date.parse(CHEONHAECHEON)

    expect(seasonPeriod(CHEONHAECHEON, undefined, startedAt).days).toBe(1)
    expect(
      seasonPeriod(CHEONHAECHEON, undefined, Date.parse('2026-03-26T15:00:00.000Z')).days
    ).toBe(2)
  })
})
