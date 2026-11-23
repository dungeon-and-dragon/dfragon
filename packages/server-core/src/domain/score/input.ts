import type { CatalogDetail } from '#domain/character-catalog/index.js'
import type { CharacterPayload, CharacterPayloads } from '#domain/character-detail/index.js'

export type ScoreCalculator = 'equipment' | 'buff'

/** 엔진이 `slotId`가 같은 원본 장비 항목을 이 항목으로 통째로 바꿔 계산한다. */
export type ScoreSimulationInput = Readonly<{
  /** 칭호(TITLE) 항목도 담을 수 있다. */
  equipment: readonly CharacterPayload[]
  /** 원본 `creature.creature`를 이 객체로 바꾼다. */
  creature?: CharacterPayload
  /** 엔진은 `slotId`가 AURORA인 항목만 바꾼다. */
  avatar?: readonly CharacterPayload[]
  /** 조율을 바꾼 `oath.crystal[]` 항목만 담고, 엔진 0.8.0부터 `slotNo`가 같은 원본 결정을 바꾼다. */
  oath?: Readonly<{ crystal: readonly CharacterPayload[] }>
}>

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
  simulation?: ScoreSimulationInput
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
