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
