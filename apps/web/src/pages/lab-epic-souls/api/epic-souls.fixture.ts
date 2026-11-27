import {
  type EquipmentVariantSlot,
  equipmentVariantsOf,
  weaponVariantsOf
} from '@dfragon/lib/equipment-variants'
import type { AdventureCharacters } from '#entities/adventure-guild'
import { storyRankedCharacters } from '#entities/ranking/api/ranked-characters.fixture'
import type { EpicSoulRecovery } from '#pages/lab-epic-souls/model/epic-soul-recovery'

// 모험단, 캐릭터 이름과 회수량은 실제 값이 아닌 합성 값이다. 아이템은 선택지 목록의 실제 아이템이다.

export const STORY_ADVENTURE = '모험단1'
export const PURIFICATION_SET = '11f7d203a05ea6f13300c0facb39f11e'
export const GOLDEN_SET = '7f788a703a87d783079b41d0fe6448c9'
const GREATSWORD = '대검'
const ACCESSORY_SLOTS: readonly string[] = ['AMULET', 'WRIST', 'RING']

type Slot = EpicSoulRecovery['souls']['slots'][number]
type WornSlot = Readonly<{ slotId: EquipmentVariantSlot; tune: number }>

export function storyAdventureCharacters(count = 6): AdventureCharacters {
  const characters = storyRankedCharacters(count).map((character) => ({
    ...character,
    adventureName: STORY_ADVENTURE
  }))

  return { adventureName: STORY_ADVENTURE, characters }
}

function variantOf(setItemId: string, slotId: EquipmentVariantSlot, rarity: string) {
  const variant = equipmentVariantsOf(setItemId, slotId).find(
    (candidate) => candidate.rarity === rarity && candidate.kind === '일반'
  )

  if (variant === undefined) {
    throw new Error(`No ${rarity} variant: ${slotId}`)
  }

  return variant.item
}

function weaponOf(rarity: string, line: string) {
  const variant = weaponVariantsOf(GREATSWORD).find(
    (candidate) => candidate.rarity === rarity && candidate.line === line
  )

  if (variant === undefined) {
    throw new Error(`No ${rarity} ${line} weapon`)
  }

  return variant
}

function soulsOf(slotId: string, tune: number): number {
  return 1 + tune * (slotId === 'WEAPON' ? 15 : 10)
}

function armorSlot({ slotId, tune }: WornSlot, setItemId: string, includePrimordial: boolean) {
  const afterRarity = includePrimordial && ACCESSORY_SLOTS.includes(slotId) ? '태초' : '레전더리'
  const before = variantOf(PURIFICATION_SET, slotId, '에픽')
  const after = variantOf(setItemId, slotId, afterRarity)
  const souls = soulsOf(slotId, tune)

  return {
    slotId,
    before: { ...before, tune, reinforce: 12, amplified: true },
    after,
    souls
  }
}

function weaponSlot(tune: number): Slot {
  const before = weaponOf('에픽', '기본').item
  const after = weaponOf('레전더리', '태초의 별')
  const souls = soulsOf('WEAPON', tune)

  return {
    slotId: 'WEAPON',
    before: { ...before, tune, reinforce: 13, amplified: true },
    after: { ...after.item, line: '태초의 별' },
    souls
  }
}

/** 무기를 끼면 태초의 별 레전더리 대검을, 아니면 무기를 바꾸지 않는 최고 세팅이다. */
export function storyRecovery(
  worn: readonly WornSlot[],
  weaponTune: number | null,
  includePrimordial: boolean,
  setItemId = GOLDEN_SET
): EpicSoulRecovery {
  const armor = worn.map((slot) => armorSlot(slot, setItemId, includePrimordial))
  const slots = weaponTune === null ? armor : [weaponSlot(weaponTune), ...armor]
  const total = slots.reduce((sum, { souls }) => sum + souls, 0)
  const weaponVariantId = weaponTune === null ? null : weaponOf('레전더리', '태초의 별').id

  return { souls: { total, slots }, best: { setItemId, weaponVariantId } }
}

export const NO_EPIC_RECOVERY: EpicSoulRecovery = { souls: { total: 0, slots: [] }, best: null }

const FULL_EPIC: readonly WornSlot[] = [
  { slotId: 'JACKET', tune: 3 },
  { slotId: 'SHOULDER', tune: 3 },
  { slotId: 'PANTS', tune: 2 },
  { slotId: 'SHOES', tune: 2 },
  { slotId: 'WAIST', tune: 3 },
  { slotId: 'AMULET', tune: 1 },
  { slotId: 'WRIST', tune: 1 },
  { slotId: 'RING', tune: 2 },
  { slotId: 'MAGIC_STON', tune: 0 },
  { slotId: 'EARRING', tune: 0 }
]

/** 캐릭터 순서별 회수 응답이다. null은 계산하지 못한 캐릭터다. */
export function storyRecoveries(includePrimordial: boolean): readonly (EpicSoulRecovery | null)[] {
  return [
    storyRecovery(FULL_EPIC, 3, includePrimordial),
    storyRecovery([{ slotId: 'RING', tune: 2 }], null, includePrimordial),
    storyRecovery([{ slotId: 'JACKET', tune: 2 }], 3, includePrimordial),
    null,
    storyRecovery([{ slotId: 'AMULET', tune: 1 }], null, includePrimordial),
    NO_EPIC_RECOVERY
  ]
}
