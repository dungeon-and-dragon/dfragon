import { type ItemStats, itemSlotName, WEAPON_SLOT } from '#entities/ranking'
import type { SetChoice } from './ranking-sets'

export type UniqueItemChoice = Readonly<{ slotId: string; label: string; itemId: string }>

// label이 null인 묶음은 묶음 헤더 없이 보인다.
export type WeaponGroup = Readonly<{ label: string | null; choices: readonly SetChoice[] }>

export type ItemChoices = Readonly<{
  weapons: readonly SetChoice[]
  weaponGroups: readonly WeaponGroup[]
  uniques: readonly UniqueItemChoice[]
}>

const NO_CHOICES: ItemChoices = { weapons: [], weaponGroups: [], uniques: [] }

type WeaponCount = ItemStats['slots'][number]['items'][number]

function choiceOf({ itemId, name }: WeaponCount): SetChoice {
  return { value: itemId, label: name }
}

// 많이 낀 순으로 받은 무기를 종류별로 묶는다. 종류는 그 안에서 가장 많이 낀 무기 순이고, 종류를 모르는 무기는 맨 끝이다.
function groupedByType(sorted: readonly WeaponCount[]): WeaponGroup[] {
  const groups = new Map<string, SetChoice[]>()
  const unknown: SetChoice[] = []

  for (const weapon of sorted) {
    if (weapon.typeDetail === null) {
      unknown.push(choiceOf(weapon))
    } else {
      groups.set(weapon.typeDetail, [...(groups.get(weapon.typeDetail) ?? []), choiceOf(weapon)])
    }
  }

  const typed = [...groups].map(([label, choices]) => ({ label, choices }))

  if (unknown.length === 0) {
    return typed
  }

  return [...typed, { label: null, choices: unknown }]
}

function byCountDesc(a: { count: number }, b: { count: number }): number {
  return b.count - a.count
}

/**
 * 무기는 많이 낀 순 전체이고, 직업을 고르지 않아 무기가 많을 때는 종류별로 묶는다.
 * 유일 장비는 부위마다 가장 많이 낀 아이템 하나를 착용 칩으로 둔다.
 */
export function itemChoicesOf(stats: ItemStats | null, groupByType: boolean): ItemChoices {
  if (stats === null) {
    return NO_CHOICES
  }

  const sorted = (stats.slots.find(({ slotId }) => slotId === WEAPON_SLOT)?.items ?? []).toSorted(
    byCountDesc
  )
  const weapons = sorted.map(choiceOf)
  const weaponGroups = groupByType ? groupedByType(sorted) : [{ label: null, choices: weapons }]
  const uniques = stats.slots.flatMap(({ slotId, items }) => {
    const [top] = items.toSorted(byCountDesc)
    if (slotId === WEAPON_SLOT || top === undefined) {
      return []
    }

    return [{ slotId, label: `${itemSlotName(slotId)} 착용`, itemId: top.itemId }]
  })

  return { weapons, weaponGroups, uniques }
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
