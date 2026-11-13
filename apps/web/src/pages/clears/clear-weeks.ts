const DAY = 24 * 60 * 60 * 1000
const WEEK_DAYS = 7
const THURSDAY = 4
const SEOUL_OFFSET = 9 * 60 * 60 * 1000
const RESET_HOUR = 6 * 60 * 60 * 1000

function dayOf(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function dateOf(day: number): string {
  return new Date(day).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return dateOf(dayOf(date) + days * DAY)
}

function weekStartOfDate(date: string): string {
  const weekday = new Date(dayOf(date)).getUTCDay()

  return addDays(date, -((weekday - THURSDAY + WEEK_DAYS) % WEEK_DAYS))
}

export function seoulDateOf(at: number): string {
  return dateOf(at + SEOUL_OFFSET)
}

// 초기화는 목요일 06:00(KST)이므로 그 전의 시각은 앞 주에 든다.
function resetWeekStartOf(at: string): string {
  return weekStartOfDate(seoulDateOf(Date.parse(at) - RESET_HOUR))
}

export function weekNumberOf(weekStart: string, releasedAt: string): number {
  const releaseWeek = resetWeekStartOf(releasedAt)

  return Math.round((dayOf(weekStart) - dayOf(releaseWeek)) / (WEEK_DAYS * DAY)) + 1
}
