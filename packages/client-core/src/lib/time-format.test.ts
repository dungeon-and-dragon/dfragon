import { expect, it } from 'vitest'
import {
  formatElapsedTime,
  formatSeoulDateTime,
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
  [29 * DAY + 23 * HOUR, 29, '일'],
  [30 * DAY, 1, '개월'],
  [364 * DAY, 12, '개월'],
  [365 * DAY, 1, '년'],
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
  [30 * DAY, DAY],
  [365 * DAY, DAY],
  [-5 * SECOND, SECOND]
])('지난 %ims의 표시는 %ims 뒤에 바뀐다', (elapsed, delay) => {
  expect(getElapsedTimeRefreshDelay(elapsed)).toBe(delay)
})

it('지난 시간은 단위 뒤에 전을 붙여 쓴다', () => {
  expect(formatElapsedTime(toElapsedTime(12_400))).toBe('12초 전')
  expect(formatElapsedTime(toElapsedTime(3 * HOUR))).toBe('3시간 전')
  expect(formatElapsedTime(toElapsedTime(45 * DAY))).toBe('1개월 전')
})

it('시각은 한국 시간 MM-DD HH:mm으로 쓰고 자정은 24시가 아니라 00시다', () => {
  expect(formatSeoulDateTime('2026-11-05T12:30:00.000Z')).toBe('11-05 21:30')
  expect(formatSeoulDateTime('2026-12-31T15:00:00.000Z')).toBe('01-01 00:00')
})
