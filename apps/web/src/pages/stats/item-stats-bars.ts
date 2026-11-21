import type { Bar } from '#shared/ui/chart/RowBars'
import { type ItemCount, type ItemStats, itemSlotName, WEAPON_SLOT } from '#entities/ranking'
import type { SetStatsFilter } from '#entities/ranking'
import { rankingLink, shareOf } from './set-stats-bars'

// 전체 직업은 무기 종류가 많아 많은 순 10개만 막대로 두고 나머지는 "그 밖" 하나로 묶는다.
const ALL_JOBS_WEAPON_LIMIT = 10
const OTHER_WEAPONS = '그 밖'
// 접두사가 붙은 무기는 성능이 같은 다른 아이템 ID라, 접두사를 뗀 이름의 무기와 한 막대로 센다.
const MERGED_WEAPON_PREFIX = '검은 질병의 '

function byCountDesc(a: { count: number }, b: { count: number }): number {
  return b.count - a.count
}

// 랭킹 필터의 itemIds는 모두 낀 캐릭터만 거르므로, 합친 막대는 접두사 없는 무기의 itemId로 잇는다.
function mergePrefixedWeapons(weapons: readonly ItemCount[]): ItemCount[] {
  const merged = new Map<string, ItemCount>()

  for (const weapon of weapons) {
    const prefixed = weapon.name.startsWith(MERGED_WEAPON_PREFIX)
    const name = prefixed ? weapon.name.slice(MERGED_WEAPON_PREFIX.length) : weapon.name
    const current = merged.get(name)

    if (current === undefined) {
      merged.set(name, { ...weapon, name })
      continue
    }

    const itemId = prefixed ? current.itemId : weapon.itemId
    merged.set(name, { ...current, itemId, count: current.count + weapon.count })
  }

  return [...merged.values()]
}

export function weaponBars(stats: ItemStats, filter: SetStatsFilter): Bar[] {
  const weapons = stats.slots.find(({ slotId }) => slotId === WEAPON_SLOT)?.items ?? []
  const sorted = mergePrefixedWeapons(weapons).toSorted(byCountDesc)
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

// 유일 장비는 지금 부위마다 한 종뿐이라 부위마다 착용 인원 한 줄로 보인다.
// 한 부위에 여러 종이 생기면 itemIds가 모두 낀 캐릭터만 거르므로 랭킹으로 잇지 않는다.
export function uniqueItemBars(stats: ItemStats, filter: SetStatsFilter): Bar[] {
  return stats.slots
    .filter(({ slotId }) => slotId !== WEAPON_SLOT)
    .map(({ slotId, items }) => {
      const value = items.reduce((sum, { count }) => sum + count, 0)
      const name = `${itemSlotName(slotId)} 유일 장비 착용`
      const [only] = items

      if (items.length !== 1 || only === undefined) {
        return { key: slotId, name, value }
      }

      const link = rankingLink(filter, { itemIds: only.itemId })

      return { key: slotId, name, value, link }
    })
}
