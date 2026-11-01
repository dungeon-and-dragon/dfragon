import type { CatalogDetail } from '../characters/catalog/types.js'
import type { CharacterPayload, CharacterPayloads } from '../characters/details/sections.js'

export type ScoreCalculator = 'equipment' | 'buff'

export type ScoreEngineInput = Readonly<{
  status: CharacterPayload
  equipment: CharacterPayload
  avatar: CharacterPayload
  creature: CharacterPayload
  oath: CharacterPayload
  mist_assimilation: CharacterPayload
  skill_style: CharacterPayload
  buff_equip_equipment: CharacterPayload
  buff_equip_avatar: CharacterPayload
  buff_equip_creature: CharacterPayload
  items: Readonly<Record<string, CharacterPayload>>
}>

/** 엔진은 Neople 섹션 응답 원문을 받으므로 상세 응답용으로 고친 값이 아니라 받은 그대로를 넘긴다. */
export function toScoreEngineInput(
  payloads: CharacterPayloads,
  catalog: ReadonlyMap<string, CatalogDetail>
): ScoreEngineInput {
  const loaded = [...catalog].flatMap(([itemId, detail]) => {
    if (detail.data === null) {
      return []
    }

    return [[itemId, detail.data] as const]
  })
  const items = Object.fromEntries(loaded)

  return {
    status: payloads.status,
    equipment: payloads.equipment,
    avatar: payloads.avatar,
    creature: payloads.creature,
    oath: payloads.oath,
    mist_assimilation: payloads.mist_assimilation,
    skill_style: payloads.skill_style,
    buff_equip_equipment: payloads.buff_equipment,
    buff_equip_avatar: payloads.buff_avatar,
    buff_equip_creature: payloads.buff_creature,
    items
  }
}
