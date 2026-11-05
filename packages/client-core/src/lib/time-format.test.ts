import { expect, it } from 'vitest'
import {
  formatSeoulDateTime,
  formatTimeAgo,
  getElapsedTimeRefreshDelay,
  toElapsedTime
} from './time-format'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

it.each([
  [0, 0, '초'],
  [12_400, 12, '초'],
  [59_999, 59, '초'],
  [MINUTE, 1, '분'],
  [59 * MINUTE + 59 * SECOND, 59, '분'],
  [HOUR, 1, '시간'],
  [23 * HOUR + 59 * MINUTE, 23, '시간'],
  [24 * HOUR, 1, '일'],
  [-5 * SECOND, 0, '초']
])('지난 %ims는 가장 큰 단위 하나의 내림 값 %i%s다', (elapsed, value, unit) => {
  expect(toElapsedTime(elapsed)).toEqual({ value, unit })
})

it.each([
  [0, SECOND],
  [12_400, 600],
  [59_500, 500],
  [MINUTE, MINUTE],
  [MINUTE + 30 * SECOND, 30 * SECOND],
  [HOUR + MINUTE, 59 * MINUTE],
  [DAY + HOUR, 23 * HOUR],
  [-5 * SECOND, SECOND]
])('지난 %ims의 표시는 %ims 뒤에 바뀐다', (elapsed, delay) => {
  expect(getElapsedTimeRefreshDelay(elapsed)).toBe(delay)
})

// 2026-02-15 09:00 KST
const NOW = Date.parse('2026-02-15T00:00:00.000Z')

it.each([
  ['2026-02-15T00:00:00.000Z', '0초 전'],
  ['2026-02-14T21:00:00.000Z', '3시간 전'],
  ['2026-01-16T00:00:01.000Z', '29일 전'],
  ['2026-01-16T00:00:00.000Z', '01-16'],
  ['2025-12-31T15:00:00.000Z', '01-01'],
  ['2025-12-31T14:59:00.000Z', '25-12-31']
])('%s는 30일 전까지 지난 시간, 그 뒤로는 한국 날짜이고 해가 다르면 연도를 붙인다', (at, text) => {
  expect(formatTimeAgo(at, NOW)).toBe(text)
})

it('title 시각은 한국 시간 HH:mm을 붙이고 자정은 24시가 아니라 00시다', () => {
  expect(formatSeoulDateTime('2026-02-14T12:30:00.000Z', NOW)).toBe('02-14 21:30')
  expect(formatSeoulDateTime('2026-01-15T15:00:00.000Z', NOW)).toBe('01-16 00:00')
  expect(formatSeoulDateTime('2025-12-31T14:59:00.000Z', NOW)).toBe('25-12-31 23:59')
})
