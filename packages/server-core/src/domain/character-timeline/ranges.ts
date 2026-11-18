import type { TimelineRange } from '@dfragon/database'

const MINUTE_MS = 60_000
// Neople 타임라인은 2017-09-21 이후 데이터만 준다(#1175 API 제약).
export const NEOPLE_TIMELINE_START = new Date('2017-09-21T00:00:00+09:00')
// 문서가 90일을 어떻게 세는지 밝히지 않아, 시작일과 끝날을 모두 세어도 90일이 되는 길이로 둔다.
// 06:00에 시작하면 89일 뒤 05:59에 끝난다(예: 20250109T0600 ~ 20250408T0559).
const MAX_RANGE_MS = 89 * 24 * 60 * MINUTE_MS - MINUTE_MS

function floorToMinute(date: Date): number {
  return Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS
}

export function splitTimelineRanges(start: Date, end: Date): TimelineRange[] {
  const last = floorToMinute(end)
  const ranges: TimelineRange[] = []
  for (let from = floorToMinute(start); from <= last; ) {
    const to = Math.min(from + MAX_RANGE_MS, last)
    ranges.push({ start: new Date(from), end: new Date(to) })
    from = to + MINUTE_MS
  }

  return ranges
}
