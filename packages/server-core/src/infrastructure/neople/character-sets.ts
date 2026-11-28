import type { CharacterEquipmentSet, CharacterItem, CharacterOathSet } from '@dfragon/database'
import { z } from 'zod'
import type { ParseCharacterSets } from '#application/character-basic/ports.js'

const nonblankString = z.string().refine((value) => value.trim().length > 0)

// 세트 포인트가 효과가 붙는 등급에 못 미친 세트는 active에 setPoint만 오고 효과 목록 status가 없다(표본에서 서약 레어 Ⅱ~Ⅴ).
// setPoint의 current와 min은 패치 뒤 접속하지 않은 캐릭터에서 효과가 켜져 있어도 current < min으로 와서 판별에 쓰지 않는다.
const effectStatus = z.array(z.unknown()).nullish()

const equipmentActiveSchema = z
  .looseObject({ setPoint: z.looseObject({ current: z.number() }), status: effectStatus })
  .nullish()

const oathActiveSchema = z.looseObject({ status: effectStatus }).nullish()

function isEffective<Active extends { status?: unknown[] | null }>(
  active: Active | null | undefined
): active is Active {
  return (active?.status?.length ?? 0) > 0
}

const equipmentSchema = z.looseObject({
  equipment: z
    .array(
      z.looseObject({
        slotId: z.string().nullish(),
        itemId: z.string().nullish(),
        itemName: z.string().nullish(),
        itemTypeDetail: z
          .string()
          .nullish()
          .transform((value) => value || null),
        setItemId: z.string().nullish(),
        setItemName: z.string().nullish(),
        exaltedInfo: z.unknown().optional()
      })
    )
    .nullish(),
  setItemInfo: z
    .array(
      z.looseObject({
        setItemId: nonblankString,
        setItemName: nonblankString,
        active: equipmentActiveSchema
      })
    )
    .nullish()
})

const oathSchema = z.looseObject({
  oath: z
    .looseObject({
      setInfo: z
        .looseObject({
          setId: z.int(),
          setName: nonblankString,
          setOptionName: z.string().nullable().default(null),
          active: oathActiveSchema
        })
        .nullish()
    })
    .nullish()
})

const wornItemFields = { itemId: z.string().nullish(), itemName: z.string().nullish() }

const avatarSchema = z.looseObject({
  avatar: z.array(z.looseObject({ slotId: z.string().nullish(), ...wornItemFields })).nullish()
})

const creatureSchema = z.looseObject({ creature: z.looseObject(wornItemFields).nullish() })

function toEquipmentSet({
  equipment,
  setItemInfo
}: z.output<typeof equipmentSchema>): CharacterEquipmentSet | null {
  const effective = (setItemInfo ?? []).flatMap(({ active, ...set }) =>
    isEffective(active) ? [{ ...set, point: active.setPoint.current }] : []
  )
  const [first, ...rest] = effective

  if (first === undefined) {
    return null
  }

  const active = rest.reduce((best, set) => (set.point > best.point ? set : best), first)
  // setItemInfo의 이름은 도달한 등급마다 달라("로열 페어리 세트") 부위 항목의 고정 이름("소울 페어리 세트")을 쓴다.
  const piece = equipment?.find(({ setItemId }) => setItemId === active.setItemId)
  const name = piece?.setItemName ?? active.setItemName

  return { id: active.setItemId, name }
}

const KEPT_EQUIPMENT_SLOT_IDS = new Set(['WEAPON', 'TITLE'])
const AURA_SLOT_ID = 'AURORA'
// 무기 아바타는 Neople 응답의 부위 id가 장비 무기와 같은 WEAPON이라, character_items에서 장비 무기와 겹치지 않게 이 부위 id로 둔다.
const WEAPON_AVATAR_SOURCE_SLOT_ID = 'WEAPON'
const WEAPON_AVATAR_SLOT_ID = 'WEAPON_AVATAR'
// 크리쳐 응답에는 부위가 없어 character_items에 이 부위 id로 둔다.
const CREATURE_SLOT_ID = 'CREATURE'

// 유일 장비는 exaltedInfo가 있는 부위라, 유일 장비가 다른 부위에 생겨도 부위 목록을 고치지 않는다.
function toEquipmentItems({ equipment }: z.output<typeof equipmentSchema>): CharacterItem[] {
  return (equipment ?? []).flatMap(({ slotId, itemId, itemName, itemTypeDetail, exaltedInfo }) => {
    const kept = (slotId != null && KEPT_EQUIPMENT_SLOT_IDS.has(slotId)) || exaltedInfo != null

    if (!kept || !slotId || !itemId || !itemName) {
      return []
    }

    return [{ slotId, itemId, itemName, typeDetail: itemTypeDetail }]
  })
}

const KEPT_AVATAR_SLOT_IDS: ReadonlyMap<string, string> = new Map([
  [AURA_SLOT_ID, AURA_SLOT_ID],
  [WEAPON_AVATAR_SOURCE_SLOT_ID, WEAPON_AVATAR_SLOT_ID]
])

function toAvatarItems({ avatar }: z.output<typeof avatarSchema>): CharacterItem[] {
  return (avatar ?? []).flatMap(({ slotId, itemId, itemName }) => {
    const keptSlotId = slotId != null ? KEPT_AVATAR_SLOT_IDS.get(slotId) : undefined

    if (keptSlotId === undefined || !itemId || !itemName) {
      return []
    }

    return [{ slotId: keptSlotId, itemId, itemName, typeDetail: null }]
  })
}

function toCreatureItems({ creature }: z.output<typeof creatureSchema>): CharacterItem[] {
  if (!creature?.itemId || !creature.itemName) {
    return []
  }

  const { itemId, itemName } = creature

  return [{ slotId: CREATURE_SLOT_ID, itemId, itemName, typeDetail: null }]
}

function toOathSet({ oath }: z.output<typeof oathSchema>): CharacterOathSet | null {
  const setInfo = oath?.setInfo

  if (setInfo == null || !isEffective(setInfo.active)) {
    return null
  }

  return { id: setInfo.setId, name: setInfo.setName, option: setInfo.setOptionName }
}

export const parseCharacterSets: ParseCharacterSets = (payloads) => {
  const equipment = equipmentSchema.safeParse(payloads.equipment)
  const oath = oathSchema.safeParse(payloads.oath)
  const avatar = avatarSchema.safeParse(payloads.avatar)
  const creature = creatureSchema.safeParse(payloads.creature)

  if (!equipment.success || !oath.success || !avatar.success || !creature.success) {
    return undefined
  }

  const equipmentSet = toEquipmentSet(equipment.data)
  const oathSet = toOathSet(oath.data)
  const items = [
    ...toEquipmentItems(equipment.data),
    ...toAvatarItems(avatar.data),
    ...toCreatureItems(creature.data)
  ]

  return { equipmentSet, oathSet, items }
}
