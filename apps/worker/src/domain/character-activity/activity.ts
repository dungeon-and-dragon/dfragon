import {
  INACTIVE_AFTER_MS,
  isRecentlyActive
} from '@dfragon/server-core/domain/character-activity.js'

export type ActivityRange = { start: Date; end: Date }

export function activityRange(now: Date): ActivityRange {
  const start = new Date(now.getTime() - INACTIVE_AFTER_MS)

  return { start, end: now }
}

/** 마지막 활동이 30일 안이면 그날까지는 활성이 확실해 타임라인을 다시 부르지 않는다. */
export function needsActivityCheck(lastActiveAt: Date | null, now: Date): boolean {
  return lastActiveAt === null || !isRecentlyActive(lastActiveAt, now)
}
