import {
  ENCHANT_GRADE_SLOTS,
  type EnchantDisplayStatus,
  type EnchantEntry,
  type EnchantGradeRole,
  type EnchantGradeSlot,
  type EnchantReinforceSkill,
  type EnchantStatus,
  groupEnchantEntries
} from '@dfragon/lib/enchant-grades'
import { LAB_ITEM_TIERS, type LabItemTier } from '@dfragon/lib/lab-items'
import type { ItemCard } from '#domain/item-detail/index.js'

const FAME_STATUS = '모험가 명성'
const SINGLE_ELEMENT_STATUS = '단일 속성 강화'
const ALL_ELEMENT_STATUS = '모든 속성 강화'
const BUFF_PASSIVE_STATUS = '버프 패시브 스킬'
const INTEGER = /^-?\d+$/
const LEADING_PLUS = /^\+/
const ROLES: readonly EnchantGradeRole[] = ['dealer', 'buffer']

// 등급표의 버퍼 항목이 쓰는 다섯 직업의 스킬이다(ADR 0094).
const BUFF_PASSIVE_SKILLS = [
  { jobName: '프리스트(남)', name: '수호의 은총' },
  { jobName: '프리스트(여)', name: '계시 : 아리아' },
  { jobName: '마법사(여)', name: '퍼페티어' },
  { jobName: '아처', name: '센세이션' },
  { jobName: '거너(여)', name: 'apius::전장정보();' }
] as const

export interface LabEnchantCardPrice {
  readonly itemName: string
  readonly unitPrice: number | null
  readonly cost: object | null
}

export interface LabEnchantSource<C extends LabEnchantCardPrice> {
  readonly slotId: EnchantGradeSlot
  readonly role: EnchantGradeRole
  readonly tier: LabItemTier
  readonly entry: EnchantEntry
  readonly card: C
}

export interface LabEnchantMember<C extends LabEnchantCardPrice> extends EnchantEntry {
  readonly card: C
}

export interface LabEnchantOption<C extends LabEnchantCardPrice> {
  readonly id: string
  readonly display: readonly EnchantDisplayStatus[]
  readonly skillLevel: number | null
  readonly cards: readonly C[]
  readonly members: readonly LabEnchantMember<C>[]
}

export interface LabEnchantTier<C extends LabEnchantCardPrice> {
  readonly tier: LabItemTier
  readonly options: readonly LabEnchantOption<C>[]
}

export interface LabEnchantSlot<C extends LabEnchantCardPrice> {
  readonly slotId: EnchantGradeSlot
  readonly role: EnchantGradeRole
  readonly tiers: readonly LabEnchantTier<C>[]
}

export interface OwnerEnchantCard {
  readonly enchants: readonly {
    readonly upgrade: number
    readonly status: readonly { readonly name: string; readonly value: string }[]
  }[]
}

// 엔진 입력은 착용 장비 응답처럼 정수 값을 숫자로, `3%` 같은 값을 문자열로 받는다.
function engineValue(value: string): number | string {
  if (INTEGER.test(value)) {
    return Number(value)
  }

  return value
}

function engineStatus(status: readonly { name: string; value: string }[]): EnchantStatus[] {
  return status
    .filter(({ name }) => name !== FAME_STATUS)
    .map(({ name, value }) => ({ name, value: engineValue(value) }))
}

export function neopleCardEntry(card: ItemCard): EnchantEntry | null {
  const top = card.enchants.at(-1)

  if (top === undefined) {
    return null
  }

  const status = engineStatus(top.status)
  const reinforceSkill = top.reinforceSkill.map(({ jobName, skills }) => ({
    jobName,
    skills: skills.map(({ name, value }) => ({ name, value }))
  }))

  return { status, reinforceSkill }
}

function buffPassiveSkills(level: string): EnchantReinforceSkill[] {
  const amount = Number(level.replace(LEADING_PLUS, ''))
  const value = String(amount)

  return BUFF_PASSIVE_SKILLS.map(({ jobName, name }) => ({ jobName, skills: [{ name, value }] }))
}

export function ownerCardEntry(card: OwnerEnchantCard): EnchantEntry | null {
  const top = card.enchants.toSorted((left, right) => left.upgrade - right.upgrade).at(-1)

  if (top === undefined) {
    return null
  }

  const buffPassive = top.status.find(({ name }) => name === BUFF_PASSIVE_STATUS)
  const status = engineStatus(
    top.status
      .filter(({ name }) => name !== BUFF_PASSIVE_STATUS)
      .map(({ name, value }) => {
        if (name === SINGLE_ELEMENT_STATUS) {
          return { name: ALL_ELEMENT_STATUS, value }
        }

        return { name, value }
      })
  )

  const reinforceSkill = buffPassive !== undefined ? buffPassiveSkills(buffPassive.value) : []

  return { status, reinforceSkill }
}

function priceRank({ unitPrice, cost }: LabEnchantCardPrice): number {
  if (unitPrice !== null) {
    return 0
  }

  if (cost !== null) {
    return 1
  }

  return 2
}

function compareCards(left: LabEnchantCardPrice, right: LabEnchantCardPrice): number {
  const rankOrder = priceRank(left) - priceRank(right)

  if (rankOrder !== 0) {
    return rankOrder
  }

  if (left.unitPrice !== null && right.unitPrice !== null && left.unitPrice !== right.unitPrice) {
    return left.unitPrice - right.unitPrice
  }

  return left.itemName.localeCompare(right.itemName, 'ko')
}

function skillLevelOf(members: readonly EnchantEntry[]): number | null {
  const levels = members.flatMap(({ reinforceSkill }) =>
    reinforceSkill.flatMap(({ skills }) => skills.map(({ value }) => Number(value)))
  )

  if (levels.length === 0) {
    return null
  }

  return Math.max(...levels)
}

/** 묶음의 표시를 짧은 문자열로 줄이고, 같은 표시면 같은 값이다. */
export type DigestOptionKey = (key: string) => string

// 묶음의 표시로 정해 실험실 목록이 그대로면 요청마다 같고, 등급표 id와 겹치지 않게 접두어를 둔다.
function optionId(
  slotId: EnchantGradeSlot,
  role: EnchantGradeRole,
  key: string,
  digest: DigestOptionKey
): string {
  return `lab:${slotId}:${role}:${digest(key)}`
}

type TieredMember<C extends LabEnchantCardPrice> = LabEnchantMember<C> & {
  readonly tier: LabItemTier
}

function slotOptions<C extends LabEnchantCardPrice>(
  slotId: EnchantGradeSlot,
  role: EnchantGradeRole,
  sources: readonly LabEnchantSource<C>[],
  digest: DigestOptionKey
): LabEnchantSlot<C> {
  const members: TieredMember<C>[] = sources
    .filter((source) => source.slotId === slotId && source.role === role)
    .toSorted((left, right) => compareCards(left.card, right.card))
    .map(({ tier, entry, card }) => ({ ...entry, card, tier }))

  // 같은 선택지가 두 등급에 걸치면 높은 등급에 둔다.
  const grouped = groupEnchantEntries(members).map((group) => {
    const tier = LAB_ITEM_TIERS.find((candidate) =>
      group.members.some((member) => member.tier === candidate)
    )!
    const id = optionId(slotId, role, group.key, digest)
    const skillLevel = skillLevelOf(group.members)
    const cards = group.members.map(({ card }) => card)
    const option: LabEnchantOption<C> = {
      id,
      display: group.display,
      skillLevel,
      cards,
      members: group.members
    }

    return { tier, option }
  })

  const tiers = LAB_ITEM_TIERS.map((tier) => {
    const options = grouped.filter((group) => group.tier === tier).map(({ option }) => option)

    return { tier, options }
  })

  const filledTiers = tiers.filter(({ options }) => options.length > 0)

  return { slotId, role, tiers: filledTiers }
}

/** 부위는 등급표 부위 순서, 역할은 딜러 다음 버퍼, 등급은 종결, 준종결, 배럭 순이고 선택지가 없는 부위와 등급은 뺀다. */
export function labEnchantOptions<C extends LabEnchantCardPrice>(
  sources: readonly LabEnchantSource<C>[],
  digest: DigestOptionKey
): LabEnchantSlot<C>[] {
  const slots = ENCHANT_GRADE_SLOTS.flatMap((slotId) =>
    ROLES.map((role) => slotOptions(slotId, role, sources, digest))
  )

  return slots.filter(({ tiers }) => tiers.length > 0)
}

export function findLabEnchantOption<C extends LabEnchantCardPrice>(
  slots: readonly LabEnchantSlot<C>[],
  slotId: EnchantGradeSlot,
  role: EnchantGradeRole,
  id: string
): LabEnchantOption<C> | null {
  const slot = slots.find((candidate) => candidate.slotId === slotId && candidate.role === role)
  const options = slot?.tiers.flatMap((tier) => tier.options) ?? []
  const option = options.find((candidate) => candidate.id === id)

  if (option === undefined) {
    return null
  }

  return option
}
