const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ELAPSED_TIME_LIMIT = 30 * DAY

const UNITS = [
  { size: DAY, unit: '일' },
  { size: HOUR, unit: '시간' },
  { size: MINUTE, unit: '분' },
  { size: SECOND, unit: '초' }
] as const

const SMALLEST_UNIT = UNITS[UNITS.length - 1]

export type ElapsedTime = { value: number; unit: (typeof UNITS)[number]['unit'] }

export function toElapsedTime(elapsedMs: number): ElapsedTime {
  const elapsed = Math.max(0, elapsedMs)
  const { size, unit } = UNITS.find((candidate) => elapsed >= candidate.size) ?? SMALLEST_UNIT

  return { value: Math.floor(elapsed / size), unit }
}

export function getElapsedTimeRefreshDelay(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs)
  const { size } = UNITS.find((candidate) => elapsed >= candidate.size) ?? SMALLEST_UNIT

  return size - (elapsed % size)
}

const seoulDateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

function seoulParts(at: number): Readonly<Record<string, string>> {
  return Object.fromEntries(seoulDateTime.formatToParts(at).map(({ type, value }) => [type, value]))
}

function seoulDate(at: number, now: number): string {
  const parts = seoulParts(at)
  if (parts.year === seoulParts(now).year) {
    return `${parts.month}-${parts.day}`
  }

  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatSeoulDateTime(at: string, now: number): string {
  const time = Date.parse(at)
  const { hour, minute } = seoulParts(time)

  return `${seoulDate(time, now)} ${hour}:${minute}`
}

// API DB의 seasons 테이블과 같은 값이다. 새 시즌을 넣는 migration을 더할 때 맨 앞에 같이 더한다.
const SEASONS = [
  { name: '천해천', startsAt: Date.parse('2026-03-26T06:00:00+09:00') },
  { name: '중천', startsAt: Date.parse('2025-01-09T06:00:00+09:00') },
  { name: '선계', startsAt: Date.parse('2023-09-14T06:00:00+09:00') },
  { name: 'THE NEXT JOURNEY', startsAt: Date.parse('2022-03-17T06:00:00+09:00') },
  { name: '귀환', startsAt: Date.parse('2020-01-09T06:00:00+09:00') },
  { name: '할렘', startsAt: Date.parse('2018-08-09T06:00:00+09:00') },
  { name: '마계', startsAt: Date.parse('2016-09-01T06:00:00+09:00') }
] as const

export function formatSeason(at: string): string | null {
  const time = Date.parse(at)
  const season = SEASONS.find(({ startsAt }) => time >= startsAt)
  if (season === undefined) {
    return null
  }

  return season.name
}

export function formatTimeAgo(at: string, now: number): string {
  const time = Date.parse(at)
  const elapsed = now - time
  if (elapsed >= ELAPSED_TIME_LIMIT) {
    return seoulDate(time, now)
  }

  const { value, unit } = toElapsedTime(elapsed)

  return `${value}${unit} 전`
}
