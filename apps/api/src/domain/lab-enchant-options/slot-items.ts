import { LAB_ITEM_TIERS, type LabItemTier, type SlotItemCategory } from '@dfragon/lib/lab-items'
import { compareCards, type DigestOptionKey, type LabEnchantCardPrice } from './options.js'

export interface LabSlotItem {
  readonly itemId: string
  readonly itemName: string
  readonly itemRarity: string
}

/** performanceKey가 같은 아이템은 효과가 같아 한 선택지로 묶는다. item이 null이면 엔진에 넘길 아이템을 찾지 못한 항목이다. */
export interface LabSlotItemSource<C extends LabEnchantCardPrice> {
  readonly category: SlotItemCategory
  readonly tier: LabItemTier
  readonly fame: number | null
  readonly performanceKey: string | null
  readonly card: C
  readonly item: LabSlotItem | null
}

export interface LabSlotItemOption<C extends LabEnchantCardPrice> {
  readonly id: string
  readonly fame: number | null
  readonly cards: readonly C[]
  readonly item: LabSlotItem
}

export interface LabSlotItemTier<C extends LabEnchantCardPrice> {
  readonly tier: LabItemTier
  readonly options: readonly LabSlotItemOption<C>[]
}

export interface LabSlotItemGroup<C extends LabEnchantCardPrice> {
  readonly category: SlotItemCategory
  readonly tiers: readonly LabSlotItemTier<C>[]
}

function keyOf({ performanceKey, card }: LabSlotItemSource<LabEnchantCardPrice>): string {
  if (performanceKey === null) {
    return `item:${card.itemName}`
  }

  return performanceKey
}

function compareFames(left: number | null, right: number | null): number {
  return (right ?? 0) - (left ?? 0)
}

function groupedOptions<C extends LabEnchantCardPrice>(
  category: SlotItemCategory,
  sources: readonly LabSlotItemSource<C>[],
  digest: DigestOptionKey
) {
  const members = sources
    .filter((source) => source.category === category)
    .toSorted((left, right) => compareCards(left.card, right.card))
  const keys = [...new Set(members.map(keyOf))]

  return keys.flatMap((key) => {
    const grouped = members.filter((member) => keyOf(member) === key)
    const item = grouped.find((member) => member.item !== null)?.item

    if (item == null) {
      return []
    }

    // 같은 선택지가 두 등급에 걸치면 높은 등급에 둔다.
    const tier = LAB_ITEM_TIERS.find((candidate) =>
      grouped.some((member) => member.tier === candidate)
    )!
    const fame = grouped.find((member) => member.fame !== null)?.fame ?? null
    const id = `lab:${category}:${digest(key)}`
    const cards = grouped.map(({ card }) => card)
    const option: LabSlotItemOption<C> = { id, fame, cards, item }

    return [{ tier, option }]
  })
}

/** 종류는 categories 순, 등급은 종결, 준종결, 배럭 순, 등급 안은 명성이 높은 순이고 엔진에 넘길 아이템이 없는 선택지와 선택지가 없는 종류는 뺀다. */
export function labSlotItemOptions<C extends LabEnchantCardPrice>(
  categories: readonly SlotItemCategory[],
  sources: readonly LabSlotItemSource<C>[],
  digest: DigestOptionKey
): LabSlotItemGroup<C>[] {
  const groups = categories.map((category) => {
    const grouped = groupedOptions(category, sources, digest)
    const tiers = LAB_ITEM_TIERS.map((tier) => {
      const options = grouped
        .filter((group) => group.tier === tier)
        .map(({ option }) => option)
        .toSorted((left, right) => compareFames(left.fame, right.fame))

      return { tier, options }
    }).filter(({ options }) => options.length > 0)

    return { category, tiers }
  })

  return groups.filter(({ tiers }) => tiers.length > 0)
}

export function findLabSlotItemOption<C extends LabEnchantCardPrice>(
  groups: readonly LabSlotItemGroup<C>[],
  category: SlotItemCategory,
  id: string
): LabSlotItemOption<C> | null {
  const group = groups.find((candidate) => candidate.category === category)
  const options = group?.tiers.flatMap((tier) => tier.options) ?? []
  const option = options.find((candidate) => candidate.id === id)

  if (option === undefined) {
    return null
  }

  return option
}
