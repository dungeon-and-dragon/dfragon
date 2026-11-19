import { type ItemStats, itemSlotName, WEAPON_SLOT } from '#core/ranking'
import type { SetChoice } from './ranking-sets'

export type UniqueItemChoice = Readonly<{ slotId: string; label: string; itemId: string }>

export type ItemChoices = Readonly<{
  weapons: readonly SetChoice[]
  uniques: readonly UniqueItemChoice[]
}>

const NO_CHOICES: ItemChoices = { weapons: [], uniques: [] }

function byCountDesc(a: { count: number }, b: { count: number }): number {
  return b.count - a.count
}

/** 무기는 많이 낀 순 전체, 유일 장비는 부위마다 가장 많이 낀 아이템 하나를 착용 칩으로 둔다. */
export function itemChoicesOf(stats: ItemStats | null): ItemChoices {
  if (stats === null) {
    return NO_CHOICES
  }

  const weapons = (stats.slots.find(({ slotId }) => slotId === WEAPON_SLOT)?.items ?? [])
    .toSorted(byCountDesc)
    .map(({ itemId, name }) => ({ value: itemId, label: name }))
  const uniques = stats.slots.flatMap(({ slotId, items }) => {
    const [top] = items.toSorted(byCountDesc)
    if (slotId === WEAPON_SLOT || top === undefined) {
      return []
    }

    return [{ slotId, label: `${itemSlotName(slotId)} 착용`, itemId: top.itemId }]
  })

  return { weapons, uniques }
}

function isUnique(choices: ItemChoices, itemId: string): boolean {
  return choices.uniques.some((unique) => unique.itemId === itemId)
}

// 유일 장비 칩이 아닌 itemId는 무기로 본다. 무기는 하나만 고른다.
export function chosenWeaponOf(
  choices: ItemChoices,
  itemIds: readonly string[]
): string | undefined {
  return itemIds.find((itemId) => !isUnique(choices, itemId))
}

export function withWeapon(
  choices: ItemChoices,
  itemIds: readonly string[],
  weapon: string | undefined
): string[] {
  const uniques = itemIds.filter((itemId) => isUnique(choices, itemId))
  if (weapon === undefined) {
    return uniques
  }

  return [...uniques, weapon]
}

export function withUniqueToggled(itemIds: readonly string[], itemId: string): string[] {
  if (itemIds.includes(itemId)) {
    return itemIds.filter((chosen) => chosen !== itemId)
  }

  return [...itemIds, itemId]
}

/** 고른 직업, 전직의 통계에 없는 아이템을 뺀다. 통계가 비었으면 판단할 수 없어 그대로 둔다. */
export function itemIdsInStats(stats: ItemStats, itemIds: readonly string[]): readonly string[] {
  if (stats.sampleSize === 0) {
    return itemIds
  }

  const known = new Set(stats.slots.flatMap(({ items }) => items.map(({ itemId }) => itemId)))

  return itemIds.filter((itemId) => known.has(itemId))
}
