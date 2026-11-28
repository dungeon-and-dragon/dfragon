import {
  type EquipmentVariantSlot,
  equipmentVariantsOf,
  weaponVariantsOf
} from '@dfragon/lib/equipment-variants'
import type { AdventureCharacters } from '#entities/adventure-guild'
import { storyRankedCharacters } from '#entities/ranking/api/ranked-characters.fixture'
import type { EpicSoulSlot, EpicSouls } from '#pages/lab-epic-souls/model/epic-soul-recovery'

// 모험단, 캐릭터 이름과 회수량은 실제 값이 아닌 합성 값이다. 아이템은 선택지 목록의 실제 아이템이다.

export const STORY_ADVENTURE = '모험단1'
const PURIFICATION_SET = '11f7d203a05ea6f13300c0facb39f11e'
const GREATSWORD = '대검'

type WornSlot = Readonly<{ slotId: EquipmentVariantSlot; tune: number }>

export function storyAdventureCharacters(count = 6): AdventureCharacters {
  const characters = storyRankedCharacters(count).map((character) => ({
    ...character,
    adventureName: STORY_ADVENTURE
  }))

  return { adventureName: STORY_ADVENTURE, characters }
}

function soulsOf(slotId: string, tune: number): number {
  return 1 + tune * (slotId === 'WEAPON' ? 15 : 10)
}

function armorSlot({ slotId, tune }: WornSlot): EpicSoulSlot {
  const item = equipmentVariantsOf(PURIFICATION_SET, slotId).find(
    (candidate) => candidate.rarity === '에픽' && candidate.kind === '일반'
  )?.item

  if (item === undefined) {
    throw new Error(`No epic variant: ${slotId}`)
  }

  const souls = soulsOf(slotId, tune)

  return { slotId, ...item, tune, souls }
}

function weaponSlot(tune: number): EpicSoulSlot {
  const item = weaponVariantsOf(GREATSWORD).find(
    (candidate) => candidate.rarity === '에픽' && candidate.line === '기본'
  )?.item

  if (item === undefined) {
    throw new Error('No epic weapon')
  }

  const souls = soulsOf('WEAPON', tune)

  return { slotId: 'WEAPON', ...item, tune, souls }
}

export function storyEpicSouls(worn: readonly WornSlot[], weaponTune: number | null): EpicSouls {
  const armor = worn.map(armorSlot)
  const slots = weaponTune === null ? armor : [weaponSlot(weaponTune), ...armor]
  const total = slots.reduce((sum, { souls }) => sum + souls, 0)

  return { total, slots }
}

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
export function storyRecoveries(): readonly (EpicSouls | null)[] {
  return [
    storyEpicSouls(FULL_EPIC, 3),
    storyEpicSouls([{ slotId: 'RING', tune: 2 }], null),
    storyEpicSouls([{ slotId: 'JACKET', tune: 2 }], 3),
    null,
    storyEpicSouls([{ slotId: 'AMULET', tune: 1 }], null),
    { total: 0, slots: [] }
  ]
}
