const seoulDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

function seoulDateParts(at: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    seoulDate.formatToParts(Date.parse(at)).map(({ type, value }) => [type, value])
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

function seoulDayNumber(at: number): number {
  const { year, month, day } = seoulDateParts(new Date(at).toISOString())

  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS
}

function formatDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10).replaceAll('-', '.')
}

export type SeasonPeriod = Readonly<{ range: string; days: number }>

export function seasonPeriod(
  startsAt: string,
  nextStartsAt: string | undefined,
  now: number
): SeasonPeriod {
  const first = seoulDayNumber(Date.parse(startsAt))
  const start = formatDayNumber(first)

  if (nextStartsAt === undefined) {
    const range = `${start} ~`
    const days = seoulDayNumber(now) - first + 1

    return { range, days }
  }

  const last = seoulDayNumber(Date.parse(nextStartsAt)) - 1
  const range = `${start} ~ ${formatDayNumber(last)}`
  const days = last - first + 1

  return { range, days }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const seoulTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export function formatMonthDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`)

  return `${day.getUTCMonth() + 1}월 ${day.getUTCDate()}일`
}

export function formatActivityDate(date: string): string {
  return `${formatMonthDay(date)} (${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]})`
}

export function formatSeoulTime(at: string): string {
  return seoulTime.format(Date.parse(at))
}
