import { describe, expect, it } from 'vitest'
import {
  describeSchedule,
  formatAgo,
  formatDateSecond,
  formatDuration,
  formatSummary
} from './format'

describe('운영 화면 표시 형식', () => {
  it.each([
    [1_000, '1초'],
    [161_000, '2분 41초'],
    [723_000, '12분 03초'],
    [3_780_000, '1시간 03분'],
    [15_120_000, '4시간 12분']
  ])('걸린 시간 %ims는 %s로 쓴다', (milliseconds, expected) => {
    expect(formatDuration(milliseconds)).toBe(expected)
  })

  it('worker 경과 시간은 1분이 지나면 분으로 쓴다', () => {
    expect(formatAgo(45_000)).toBe('45초 전')
    expect(formatAgo(87 * 60_000 + 5_000)).toBe('87분 전')
  })

  it('시각은 서울 시간으로 쓴다', () => {
    expect(formatDateSecond(new Date('2026-11-09T15:00:00.000Z'))).toBe('11-10 00:00:00')
  })

  it('매일 같은 시각의 cron 식만 설명을 붙인다', () => {
    expect(describeSchedule('0 6 * * *')).toBe('매일 06:00')
    expect(describeSchedule('*/5 * * * *')).toBeUndefined()
  })

  it('결과 요약은 키와 값을 차례로 잇고 수는 자리 구분을 넣는다', () => {
    expect(formatSummary({ requests: 100412, records: 18233 })).toBe(
      'requests 100,412 records 18,233'
    )
  })
})
