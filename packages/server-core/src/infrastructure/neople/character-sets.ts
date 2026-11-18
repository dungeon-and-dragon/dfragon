import type { CharacterEquipmentSet, CharacterItem, CharacterOathSet } from '@dfragon/database'
import { z } from 'zod'
import type { ParseCharacterSets } from '#application/character-basic/ports.js'

const nonblankString = z.string().refine((value) => value.trim().length > 0)

const equipmentSchema = z.looseObject({
  equipment: z
    .array(
      z.looseObject({
        slotId: z.string().nullish(),
        itemId: z.string().nullish(),
        itemName: z.string().nullish(),
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
        active: z.looseObject({ setPoint: z.looseObject({ current: z.number() }) })
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
          setOptionName: z.string().nullable().default(null)
        })
        .nullish()
    })
    .nullish()
})

function toEquipmentSet({
  equipment,
  setItemInfo
}: z.output<typeof equipmentSchema>): CharacterEquipmentSet | null {
  const [first, ...rest] = setItemInfo ?? []

  if (first === undefined) {
    return null
  }

  const active = rest.reduce(
    (best, set) => (set.active.setPoint.current > best.active.setPoint.current ? set : best),
    first
  )
  // setItemInfo의 이름은 도달한 등급마다 달라("로열 페어리 세트") 부위 항목의 고정 이름("소울 페어리 세트")을 쓴다.
  const piece = equipment?.find(({ setItemId }) => setItemId === active.setItemId)
  const name = piece?.setItemName ?? active.setItemName

  return { id: active.setItemId, name }
}

const WEAPON_SLOT_ID = 'WEAPON'

// 유일 장비는 exaltedInfo가 있는 부위라, 유일 장비가 다른 부위에 생겨도 부위 목록을 고치지 않는다.
function toItems({ equipment }: z.output<typeof equipmentSchema>): CharacterItem[] {
  return (equipment ?? []).flatMap(({ slotId, itemId, itemName, exaltedInfo }) => {
    const kept = slotId === WEAPON_SLOT_ID || exaltedInfo != null

    if (!kept || !slotId || !itemId || !itemName) {
      return []
    }

    return [{ slotId, itemId, itemName }]
  })
}

function toOathSet({ oath }: z.output<typeof oathSchema>): CharacterOathSet | null {
  const setInfo = oath?.setInfo

  if (setInfo == null) {
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
