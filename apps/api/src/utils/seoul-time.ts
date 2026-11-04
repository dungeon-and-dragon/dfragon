import { tz } from '@date-fns/tz'
import { format, isValid, parse } from 'date-fns'

const inSeoul = tz('Asia/Seoul')

export function formatSeoulTime(date: Date, pattern: string): string {
  return format(date, pattern, { in: inSeoul })
}

export function parseSeoulTime(text: string, pattern: string): Date | null {
  // tz를 주면 parse가 TZDate를 돌려주므로, 호출하는 쪽에는 일반 Date로 바꿔 넘긴다.
  const date = new Date(parse(text, pattern, new Date(), { in: inSeoul }))
  if (!isValid(date)) {
    return null
  }

  return date
}
