import { z } from 'zod'

export const WEAPON_SLOT = 'WEAPON'
export const TITLE_SLOT = 'TITLE'
export const CREATURE_SLOT = 'CREATURE'
// 무기 아바타는 장비 무기와 부위 id가 겹쳐 API가 이 부위 id로 준다.
export const WEAPON_AVATAR_SLOT = 'WEAPON_AVATAR'
// 이 부위의 아이템은 이름 끝 [30Lv]처럼 Lv+1을 받는 스킬 레벨이 붙어 와서, 직업 통계가 Lv별로 센다.
export const SKILL_LEVEL_SLOTS: readonly string[] = [TITLE_SLOT, CREATURE_SLOT, WEAPON_AVATAR_SLOT]

const count = z.number().int().nonnegative()

export const itemStatsSchema = z
  .object({
    computedAt: z.iso.datetime().nullable(),
    sampleSize: count,
    slots: z.array(
      z.object({
        slotId: z.string().min(1),
        items: z.array(
          z.object({
            itemId: z.string().min(1),
            name: z.string(),
            // Neople itemTypeDetail(무기는 도, 낫 같은 종류)이고, 모르면 null이다.
            typeDetail: z.string().nullable(),
            count
          })
        )
      })
    )
  })
  .refine(({ sampleSize, slots }) =>
    slots.every(({ items }) => items.reduce((sum, item) => sum + item.count, 0) <= sampleSize)
  )

export type ItemStats = z.infer<typeof itemStatsSchema>
export type ItemSlot = ItemStats['slots'][number]
export type ItemCount = ItemSlot['items'][number]

// Neople 장비 응답의 부위 이름(slotName)이다. 아이템 통계 응답에는 부위 id만 온다.
const SLOT_NAMES: Readonly<Record<string, string>> = {
  WEAPON: '무기',
  TITLE: '칭호',
  JACKET: '상의',
  SHOULDER: '머리어깨',
  PANTS: '하의',
  SHOES: '신발',
  WAIST: '벨트',
  AMULET: '목걸이',
  WRIST: '팔찌',
  RING: '반지',
  SUPPORT: '보조장비',
  MAGIC_STON: '마법석',
  EARRING: '귀걸이'
}

export function itemSlotName(slotId: string): string {
  const name = SLOT_NAMES[slotId]
  if (name === undefined) {
    return slotId
  }

  return name
}
