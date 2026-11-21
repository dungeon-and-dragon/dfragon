import { type ItemCount, type ItemStats, type SetStatsFilter, WEAPON_SLOT } from '#entities/ranking'
import { byCountDesc, type ItemBar, mergePrefixedWeapons } from './item-stats-bars'
import { rankingLink, shareOf } from './set-stats-bars'

const TYPE_WEAPON_LIMIT = 10
// 비율은 소수 한 자리로 보이므로, 0.0%로 반올림되는 무기는 막대를 두지 않고 그 밖에 묶는다.
const MIN_SHOWN_SHARE = 0.05
const OTHER_WEAPONS = '그 밖'
const UNKNOWN_TYPE = '종류 없음'

export type WeaponType = Readonly<{
  name: string
  count: number
  share: number
  weapons: readonly ItemBar[]
}>

function weaponBarsOf(
  weapons: readonly ItemCount[],
  total: number,
  filter: SetStatsFilter
): ItemBar[] {
  const sorted = weapons.toSorted(byCountDesc)
  const visibleCount = sorted
    .slice(0, TYPE_WEAPON_LIMIT)
    .filter(({ count }) => shareOf(count, total) >= MIN_SHOWN_SHARE).length

  const shown: ItemBar[] = sorted.slice(0, visibleCount).map(({ itemId, name, count }) => {
    const value = shareOf(count, total)
    const link = rankingLink(filter, { itemIds: itemId })

    return { key: itemId, itemId, name, value, link }
  })

  const rest = sorted.slice(visibleCount)

  if (rest.length === 0) {
    return shown
  }

  const restCount = rest.reduce((sum, { count }) => sum + count, 0)
  const restShare = shareOf(restCount, total)
  const restName = `${OTHER_WEAPONS} ${rest.length}종`

  return [
    ...shown,
    {
      key: OTHER_WEAPONS,
      itemId: null,
      name: restName,
      value: restShare,
      base: true
    }
  ]
}

export function weaponTypesOf(stats: ItemStats, filter: SetStatsFilter): WeaponType[] {
  const weapons = stats.slots.find(({ slotId }) => slotId === WEAPON_SLOT)?.items ?? []
  const byType = Map.groupBy(
    mergePrefixedWeapons(weapons),
    ({ typeDetail }) => typeDetail ?? UNKNOWN_TYPE
  )

  return [...byType]
    .map(([name, items]) => {
      const count = items.reduce((sum, item) => sum + item.count, 0)
      const share = shareOf(count, stats.sampleSize)
      const weaponBars = weaponBarsOf(items, count, filter)

      return { name, count, share, weapons: weaponBars }
    })
    .toSorted(byCountDesc)
}
