import type { CharacterDetailView } from './character-detail-view'

type BuffSkillInfo = NonNullable<NonNullable<CharacterDetailView['buff']['equipment']>['skillInfo']>

const ITEM_RARITY_BY_NAME = {
  커먼: 'common',
  언커먼: 'uncommon',
  레어: 'rare',
  유니크: 'unique',
  레전더리: 'legendary',
  에픽: 'epic',
  크로니클: 'chronicle',
  태초: 'primordial',
  신화: 'mythic'
} as const

export type ItemRarity = (typeof ITEM_RARITY_BY_NAME)[keyof typeof ITEM_RARITY_BY_NAME]

export function itemRarityOf(name: string | null): ItemRarity | null {
  const rarityByName: Readonly<Record<string, ItemRarity>> = ITEM_RARITY_BY_NAME
  const rarity = name != null ? rarityByName[name] : undefined
  if (rarity == null) {
    return null
  }

  return rarity
}

const AVATAR_SLOT_SUFFIX = ' 아바타'

export function avatarSlotLabel(slotName: string | null): string | null {
  if (slotName?.endsWith(AVATAR_SLOT_SUFFIX)) {
    return slotName.slice(0, -AVATAR_SLOT_SUFFIX.length)
  }

  return slotName
}

export function buffSkillInfoOf(buff: CharacterDetailView['buff']): BuffSkillInfo | null {
  const skillInfo = buff.equipment?.skillInfo ?? buff.avatar?.skillInfo ?? buff.creature?.skillInfo
  if (skillInfo == null) {
    return null
  }

  return skillInfo
}

const ELEMENT_BY_STATUS_NAME = {
  '화속성 강화': 'fire',
  '수속성 강화': 'water',
  '명속성 강화': 'light',
  '암속성 강화': 'shadow'
} as const

export type StatusElement = (typeof ELEMENT_BY_STATUS_NAME)[keyof typeof ELEMENT_BY_STATUS_NAME]

export function statusElementOf(name: string | null): StatusElement | null {
  const elementByName: Readonly<Record<string, StatusElement>> = ELEMENT_BY_STATUS_NAME
  const element = name != null ? elementByName[name] : undefined
  if (element == null) {
    return null
  }

  return element
}

const statNumber = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 })

export function formatStatValue(value: number | string): string {
  if (typeof value === 'number') {
    return statNumber.format(value)
  }

  return value
}
