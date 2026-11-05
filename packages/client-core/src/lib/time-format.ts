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

export function formatTimeAgo(at: string, now: number): string {
  const time = Date.parse(at)
  const elapsed = now - time
  if (elapsed >= ELAPSED_TIME_LIMIT) {
    return seoulDate(time, now)
  }

  const { value, unit } = toElapsedTime(elapsed)

  return `${value}${unit} 전`
}
