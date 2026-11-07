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

export function formatSeasonYear(startsAt: string): string {
  return seoulDateParts(startsAt).year
}

export function formatSeasonStart(startsAt: string): string {
  const { year, month, day } = seoulDateParts(startsAt)

  return `${year}.${month}.${day} ~`
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
