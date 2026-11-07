import { type SeoulWeeklyTime, latestSeoulWeeklyTime } from '../utils/seoul-time.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// 목요일 01:00(KST)
export const SKILL_STYLE_REFRESH_START: SeoulWeeklyTime = { weekday: 4, hour: 1 }

export function latestRefreshStart(now: Date): Date {
  return latestSeoulWeeklyTime(now, SKILL_STYLE_REFRESH_START)
}

export function msUntilNextRefresh(now: Date): number {
  // 한국은 서머타임이 없어 한 주가 늘 같은 길이다. 프로세스 TZ의 날짜 계산을 쓰면 그 TZ의 서머타임 경계에서 1시간 어긋난다.
  return latestRefreshStart(now).getTime() + WEEK_MS - now.getTime()
}
