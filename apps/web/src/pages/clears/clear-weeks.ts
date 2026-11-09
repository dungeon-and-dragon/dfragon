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

export function weekStartOfDate(date: string): string {
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

function monthDay(date: string): string {
  return date.slice(5)
}

export function weekLabel(weekStart: string, releasedAt: string): string {
  return `${weekNumberOf(weekStart, releasedAt)}주차 ${monthDay(weekStart)}`
}

export function weekRangeLabel(weekStart: string, releasedAt: string): string {
  const weekEnd = addDays(weekStart, WEEK_DAYS - 1)

  return `${weekNumberOf(weekStart, releasedAt)}주차 ${monthDay(weekStart)} ~ ${monthDay(weekEnd)}`
}

export type CalendarMonth = Readonly<{ year: number; month: number }>

export type CalendarDay = Readonly<{ date: string; day: number; inMonth: boolean }>

export type CalendarWeek = Readonly<{ weekStart: string; days: readonly CalendarDay[] }>

export function monthOf(date: string): CalendarMonth {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))

  return { year, month }
}

export function shiftMonth({ year, month }: CalendarMonth, months: number): CalendarMonth {
  const index = year * 12 + month - 1 + months
  const shiftedYear = Math.floor(index / 12)
  const shiftedMonth = (index % 12) + 1

  return { year: shiftedYear, month: shiftedMonth }
}

export function firstDateOf({ year, month }: CalendarMonth): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function lastDateOf(month: CalendarMonth): string {
  return addDays(firstDateOf(shiftMonth(month, 1)), -1)
}

export function calendarWeeks(month: CalendarMonth): CalendarWeek[] {
  const last = lastDateOf(month)
  const weeks: CalendarWeek[] = []
  for (
    let weekStart = weekStartOfDate(firstDateOf(month));
    weekStart <= last;
    weekStart = addDays(weekStart, WEEK_DAYS)
  ) {
    const days = Array.from({ length: WEEK_DAYS }, (_, offset) => {
      const date = addDays(weekStart, offset)
      const day = Number(date.slice(8))
      const inMonth = monthOf(date).month === month.month

      return { date, day, inMonth }
    })
    weeks.push({ weekStart, days })
  }

  return weeks
}
