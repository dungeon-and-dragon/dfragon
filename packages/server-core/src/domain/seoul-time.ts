import { tz } from '@date-fns/tz'
import {
  addDays,
  addHours,
  format,
  isValid,
  parse,
  startOfDay,
  startOfWeek,
  subHours
} from 'date-fns'

const inSeoul = tz('Asia/Seoul')
const THURSDAY = 4
const RESET_HOUR = 6
const RESET_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const RESET_DATE_HOUR_PATTERN = 'yyyy-MM-dd H'

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

// 던파의 한 주는 목요일 06:00(KST)에 시작한다. 한국은 서머타임이 없어 시각을 더하고 빼도 어긋나지 않는다.
export function startOfResetWeek(date: Date): Date {
  const start = startOfWeek(subHours(date, RESET_HOUR), {
    weekStartsOn: THURSDAY,
    in: inSeoul
  })

  return new Date(addHours(start, RESET_HOUR))
}

// 던파의 하루도 06:00(KST)에 바뀐다. 그 전 기록은 전날로 센다.
export function formatResetDate(date: Date): string {
  return formatSeoulTime(subHours(date, RESET_HOUR), 'yyyy-MM-dd')
}

export function parseResetDate(text: string): Date | null {
  if (!RESET_DATE_PATTERN.test(text)) {
    return null
  }

  return parseSeoulTime(`${text} ${RESET_HOUR}`, RESET_DATE_HOUR_PATTERN)
}

export function startOfNextSeoulDay(date: Date): Date {
  return new Date(addDays(startOfDay(date, { in: inSeoul }), 1))
}
