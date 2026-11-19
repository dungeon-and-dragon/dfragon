import type { ActivitySummary } from '#core/adventure-guild'

export type RarityCounts = ActivitySummary['oaths'] &
  Partial<Pick<ActivitySummary['items'], 'mythic'>>

export function rarityTotal({ legendary, epic, primeval, mythic = 0 }: RarityCounts): number {
  return legendary + epic + primeval + mythic
}
