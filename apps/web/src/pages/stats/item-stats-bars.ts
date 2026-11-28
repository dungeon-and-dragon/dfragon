import type { Bar } from '#shared/ui/chart/RowBars'
import { type ItemCount, type ItemStats, WEAPON_SLOT } from '#entities/ranking'
import type { SetStatsFilter } from '#entities/ranking'
import { rankingLink, shareOf } from './set-stats-bars'

// 전체 직업은 무기 종류가 많아 많은 순 10개만 막대로 두고 나머지는 "그 밖" 하나로 묶는다.
const ALL_JOBS_WEAPON_LIMIT = 10
const OTHER_WEAPONS = '그 밖'
// 비율은 소수 한 자리로 보이므로, 0.0%로 반올림되는 무기는 막대를 두지 않는다.
const MIN_SHOWN_WEAPON_SHARE = 0.05
// 접두사가 붙은 무기는 성능이 같은 다른 아이템 ID라, 접두사를 뗀 이름의 무기와 한 막대로 센다.
const MERGED_WEAPON_PREFIXES = ['검은 질병의 ', '억압 - ']

function prefixOf(name: string): string | undefined {
  return MERGED_WEAPON_PREFIXES.find((prefix) => name.startsWith(prefix))
}

export function byCountDesc(a: { count: number }, b: { count: number }): number {
  return b.count - a.count
}

// 랭킹 필터의 itemIds는 모두 낀 캐릭터만 거르므로, 합친 막대는 접두사 없는 무기의 itemId로 잇는다.
export function mergePrefixedWeapons(weapons: readonly ItemCount[]): ItemCount[] {
  const merged = new Map<string, ItemCount>()

  for (const weapon of weapons) {
    const prefix = prefixOf(weapon.name)
    const prefixed = prefix !== undefined
    const name = prefixed ? weapon.name.slice(prefix.length) : weapon.name
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

export type ItemBar = Bar & Readonly<{ itemId: string | null }>

const headcount = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatHeadcount(count: number): string {
  return `${headcount.format(count)}명`
}

export function weaponBars(stats: ItemStats, filter: SetStatsFilter): ItemBar[] {
  const weapons = stats.slots.find(({ slotId }) => slotId === WEAPON_SLOT)?.items ?? []
  const sorted = mergePrefixedWeapons(weapons).toSorted(byCountDesc)
  const limited = filter.jobId === undefined && sorted.length > ALL_JOBS_WEAPON_LIMIT
  const shown = limited ? sorted.slice(0, ALL_JOBS_WEAPON_LIMIT) : sorted
  const bars: ItemBar[] = shown.map(({ itemId, name, count }) => {
    const value = shareOf(count, stats.sampleSize)
    const link = rankingLink(filter, { itemIds: itemId })

    return { key: itemId, itemId, name, value, link }
  })
  const visibleBars = bars.filter(({ value }) => value >= MIN_SHOWN_WEAPON_SHARE)

  if (!limited) {
    return visibleBars
  }

  const otherCount = sorted.slice(ALL_JOBS_WEAPON_LIMIT).reduce((sum, { count }) => sum + count, 0)
  const otherValue = shareOf(otherCount, stats.sampleSize)

  return [
    ...visibleBars,
    {
      key: OTHER_WEAPONS,
      itemId: null,
      name: OTHER_WEAPONS,
      value: otherValue,
      base: true
    }
  ]
}

// 유일 장비는 부위마다 한 종뿐이라 아이템을 고정해 두고, 아무도 끼지 않아 응답에 없어도 0명으로 보인다.
const UNIQUE_ITEMS: readonly Readonly<{ itemId: string; name: string }>[] = [
  { itemId: 'aa5273499f19ddba846919dbb6857d82', name: '광휘를 머금은 눈동자' },
  { itemId: '6e1fcf6e59ed8d5a95dc152b84fe93ce', name: '만병을 잉태한 역병의 심장' },
  { itemId: 'df77236c51ea1274a3deb79c3e470695', name: '우아한 기품의 향수' },
  { itemId: '14449881bc371352c250502e7b201506', name: '영롱한 날씨의 큐브' }
]

export function uniqueItemBars(stats: ItemStats, filter: SetStatsFilter): ItemBar[] {
  const counts = new Map(
    stats.slots.flatMap(({ items }) => items.map(({ itemId, count }) => [itemId, count] as const))
  )

  return UNIQUE_ITEMS.map(({ itemId, name }) => {
    const value = counts.get(itemId) ?? 0
    const link = rankingLink(filter, { itemIds: itemId })

    return { key: itemId, itemId, name, value, link }
  })
}
