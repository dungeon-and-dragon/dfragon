import type { Bar } from '#components/chart/RowBars'
import { type ItemStats, itemSlotName, type SetStatsFilter, WEAPON_SLOT } from '#core/ranking'
import { rankingLink, shareOf } from './set-stats-bars'

// 전체 직업은 무기 종류가 많아 많은 순 10개만 막대로 두고 나머지는 "그 밖" 하나로 묶는다.
const ALL_JOBS_WEAPON_LIMIT = 10
const OTHER_WEAPONS = '그 밖'

function byCountDesc(a: { count: number }, b: { count: number }): number {
  return b.count - a.count
}

export function weaponBars(stats: ItemStats, filter: SetStatsFilter): Bar[] {
  const weapons = stats.slots.find(({ slotId }) => slotId === WEAPON_SLOT)?.items ?? []
  const sorted = weapons.toSorted(byCountDesc)
  const limited = filter.jobId === undefined && sorted.length > ALL_JOBS_WEAPON_LIMIT
  const shown = limited ? sorted.slice(0, ALL_JOBS_WEAPON_LIMIT) : sorted
  const bars: Bar[] = shown.map(({ itemId, name, count }) => {
    const value = shareOf(count, stats.sampleSize)
    const link = rankingLink(filter, { itemIds: itemId })

    return { key: itemId, name, value, link }
  })

  if (!limited) {
    return bars
  }

  const otherCount = sorted.slice(ALL_JOBS_WEAPON_LIMIT).reduce((sum, { count }) => sum + count, 0)
  const otherValue = shareOf(otherCount, stats.sampleSize)

  return [...bars, { key: OTHER_WEAPONS, name: OTHER_WEAPONS, value: otherValue, base: true }]
}

// 유일 장비는 지금 부위마다 한 종뿐이라 부위마다 착용 비율 한 줄로 보인다.
// 한 부위에 여러 종이 생기면 itemIds가 모두 낀 캐릭터만 거르므로 랭킹으로 잇지 않는다.
export function uniqueItemBars(stats: ItemStats, filter: SetStatsFilter): Bar[] {
  return stats.slots
    .filter(({ slotId }) => slotId !== WEAPON_SLOT)
    .map(({ slotId, items }) => {
      const worn = items.reduce((sum, { count }) => sum + count, 0)
      const value = shareOf(worn, stats.sampleSize)
      const name = `${itemSlotName(slotId)} 유일 장비 착용`
      const [only] = items

      if (items.length !== 1 || only === undefined) {
        return { key: slotId, name, value }
      }

      const link = rankingLink(filter, { itemIds: only.itemId })

      return { key: slotId, name, value, link }
    })
}
