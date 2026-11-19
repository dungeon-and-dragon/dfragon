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

const WEAPON_SLOT_ID = 'WEAPON'

// 유일 장비는 exaltedInfo가 있는 부위라, 유일 장비가 다른 부위에 생겨도 부위 목록을 고치지 않는다.
function toItems({ equipment }: z.output<typeof equipmentSchema>): CharacterItem[] {
  return (equipment ?? []).flatMap(({ slotId, itemId, itemName, itemTypeDetail, exaltedInfo }) => {
    const kept = slotId === WEAPON_SLOT_ID || exaltedInfo != null

    if (!kept || !slotId || !itemId || !itemName) {
      return []
    }

    return [{ slotId, itemId, itemName, typeDetail: itemTypeDetail }]
  })
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

  if (!equipment.success || !oath.success) {
    return undefined
  }

  const equipmentSet = toEquipmentSet(equipment.data)
  const oathSet = toOathSet(oath.data)
  const items = toItems(equipment.data)

  return { equipmentSet, oathSet, items }
}
