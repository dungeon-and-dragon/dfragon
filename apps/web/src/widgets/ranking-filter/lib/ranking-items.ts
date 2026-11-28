import { type ItemStats, itemSlotName, SKILL_LEVEL_SLOTS, WEAPON_SLOT } from '#entities/ranking'
import { ITEM_FILTER_LIMIT } from '#shared/config/ranking'
import type { SetChoice } from './ranking-sets'

export type UniqueItemGroup = Readonly<{
  slotId: string
  label: string
  choices: readonly SetChoice[]
}>

// label이 null인 묶음은 묶음 헤더 없이 보인다.
export type WeaponGroup = Readonly<{ label: string | null; choices: readonly SetChoice[] }>

export type ItemChoices = Readonly<{
  weapons: readonly SetChoice[]
  weaponGroups: readonly WeaponGroup[]
  uniqueGroups: readonly UniqueItemGroup[]
}>

const NO_CHOICES: ItemChoices = { weapons: [], weaponGroups: [], uniqueGroups: [] }

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
 * 유일 장비는 부위별로 묶은 많이 낀 순 전체다. 칭호, 크리쳐, 무기 아바타는 유일 장비가 아니라 넣지 않는다.
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
  const uniqueGroups = stats.slots.flatMap(({ slotId, items }) => {
    if (slotId === WEAPON_SLOT || SKILL_LEVEL_SLOTS.includes(slotId) || items.length === 0) {
      return []
    }

    const label = itemSlotName(slotId)
    const choices = items.toSorted(byCountDesc).map(choiceOf)

    return [{ slotId, label, choices }]
  })

  return { weapons, weaponGroups, uniqueGroups }
}

function uniqueSlotOf(choices: ItemChoices, itemId: string): string | undefined {
  return choices.uniqueGroups.find((group) => group.choices.some(({ value }) => value === itemId))
    ?.slotId
}

function isUnique(choices: ItemChoices, itemId: string): boolean {
  return uniqueSlotOf(choices, itemId) !== undefined
}

// 유일 장비 목록에 없는 itemId는 무기로 본다. 무기는 하나만 고른다.
export function chosenWeaponOf(
  choices: ItemChoices,
  itemIds: readonly string[]
): string | undefined {
  return itemIds.find((itemId) => !isUnique(choices, itemId))
}

export function chosenUniquesOf(choices: ItemChoices, itemIds: readonly string[]): string[] {
  return itemIds.filter((itemId) => isUnique(choices, itemId))
}

export function withWeapon(
  choices: ItemChoices,
  itemIds: readonly string[],
  weapon: string | undefined
): string[] {
  const uniques = chosenUniquesOf(choices, itemIds)

  if (weapon === undefined) {
    return uniques
  }

  return [...uniques, weapon]
}

// 한 부위에서는 하나만 고르므로, 새로 고른 아이템과 같은 부위의 앞선 선택은 뺀다.
export function withUniques(
  choices: ItemChoices,
  itemIds: readonly string[],
  next: readonly string[]
): string[] {
  const added = next.filter((itemId) => !itemIds.includes(itemId))
  const addedSlots = new Set(added.map((itemId) => uniqueSlotOf(choices, itemId)))
  const kept = next.filter(
    (itemId) => added.includes(itemId) || !addedSlots.has(uniqueSlotOf(choices, itemId))
  )
  const weapon = chosenWeaponOf(choices, itemIds)

  if (weapon === undefined) {
    return kept
  }

  return [...kept, weapon]
}

// 한도에 닿으면 아직 고르지 않은 부위의 아이템은 고를 수 없다. 고른 부위의 다른 아이템은 바꿀 수 있다.
export function isUniqueBlocked(
  choices: ItemChoices,
  itemIds: readonly string[],
  itemId: string
): boolean {
  if (itemIds.length < ITEM_FILTER_LIMIT) {
    return false
  }

  const slotId = uniqueSlotOf(choices, itemId)

  return !itemIds.some((chosen) => uniqueSlotOf(choices, chosen) === slotId)
}

/** 고른 직업, 전직의 통계에 없는 아이템을 뺀다. 통계가 비었으면 판단할 수 없어 그대로 둔다. */
export function itemIdsInStats(stats: ItemStats, itemIds: readonly string[]): readonly string[] {
  if (stats.sampleSize === 0) {
    return itemIds
  }

  const known = new Set(stats.slots.flatMap(({ items }) => items.map(({ itemId }) => itemId)))

  return itemIds.filter((itemId) => known.has(itemId))
}
