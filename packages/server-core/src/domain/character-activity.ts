const DAY_MS = 24 * 60 * 60 * 1000

export const INACTIVE_AFTER_MS = 30 * DAY_MS

export function isRecentlyActive(lastActiveAt: Date, now: Date): boolean {
  return now.getTime() - lastActiveAt.getTime() < INACTIVE_AFTER_MS
}
