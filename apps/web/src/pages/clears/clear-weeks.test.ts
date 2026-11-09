import { expect, it } from 'vitest'
import { calendarWeeks, weekNumberOf, weekRangeLabel, weekStartOfDate } from './clear-weeks'

it('날짜는 그 날짜가 든 목요일 시작 주로 바꾼다', () => {
  expect(weekStartOfDate('2026-11-05')).toBe('2026-11-05')
  expect(weekStartOfDate('2026-11-11')).toBe('2026-11-05')
  expect(weekStartOfDate('2026-11-01')).toBe('2026-10-29')
  expect(weekStartOfDate('2026-01-01')).toBe('2026-01-01')
  expect(weekStartOfDate('2026-01-07')).toBe('2026-01-01')
})

it('주차는 출시한 주를 1주차로 센다', () => {
  const releasedAt = '2026-08-05T21:00:00.000Z'

  expect(weekNumberOf('2026-08-06', releasedAt)).toBe(1)
  expect(weekNumberOf('2026-11-05', releasedAt)).toBe(14)
  expect(weekRangeLabel('2026-11-05', releasedAt)).toBe('14주차 11-05 ~ 11-11')
  expect(weekRangeLabel('2026-12-31', releasedAt)).toBe('22주차 12-31 ~ 01-06')
})

it('목요일 06:00(KST) 전에 출시한 컨텐츠는 앞 주를 1주차로 센다', () => {
  expect(weekNumberOf('2026-11-05', '2026-11-04T20:59:00.000Z')).toBe(2)
})

it('달력은 그 달의 날짜를 모두 덮는 목요일 시작 주를 줄로 둔다', () => {
  const weeks = calendarWeeks({ year: 2026, month: 11 })

  expect(weeks.map(({ weekStart }) => weekStart)).toEqual([
    '2026-10-29',
    '2026-11-05',
    '2026-11-12',
    '2026-11-19',
    '2026-11-26'
  ])
  expect(weeks[0]?.days.map(({ day, inMonth }) => [day, inMonth])).toEqual([
    [29, false],
    [30, false],
    [31, false],
    [1, true],
    [2, true],
    [3, true],
    [4, true]
  ])
  expect(
    weeks
      .at(-1)
      ?.days.map(({ date }) => date)
      .at(-1)
  ).toBe('2026-12-02')
})

it('목요일로 시작하는 달은 1일이 첫 줄 첫 칸이다', () => {
  const [first] = calendarWeeks({ year: 2026, month: 10 })

  expect(first?.weekStart).toBe('2026-10-01')
})
