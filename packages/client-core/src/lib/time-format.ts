const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const UNITS = [
  { size: YEAR, unit: '년' },
  { size: MONTH, unit: '개월' },
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

export function formatElapsedTime({ value, unit }: ElapsedTime): string {
  return `${value}${unit} 전`
}

// setTimeout은 약 24.8일(2^31 - 1ms)보다 긴 지연을 바로 실행하므로, 개월과 년 단위도 하루씩 나눠 기다린다.
export function getElapsedTimeRefreshDelay(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs)
  const { size } = UNITS.find((candidate) => elapsed >= candidate.size) ?? SMALLEST_UNIT

  return Math.min(size - (elapsed % size), DAY)
}

const seoulDateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export function formatSeoulDateTime(at: string): string {
  const parts = Object.fromEntries(
    seoulDateTime.formatToParts(new Date(at)).map(({ type, value }) => [type, value])
  )

  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}
