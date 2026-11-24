import type { CatalogDetail } from '#domain/character-catalog/index.js'
import type { CharacterPayload, CharacterPayloads } from '#domain/character-detail/index.js'

export type ScoreCalculator = 'equipment' | 'buff'

/** 엔진이 `slotId`가 같은 원본 장비 항목을 이 항목으로 통째로 바꿔 계산한다. */
export type ScoreSimulationInput = Readonly<{
  /** 칭호(TITLE) 항목도 담을 수 있다. */
  equipment: readonly CharacterPayload[]
  /** 원본 `creature.creature`를 이 객체로 바꾼다. */
  creature?: CharacterPayload
  /**
   * 0.10.0까지 엔진은 `slotId`가 AURORA인 항목만 바꾼다. 0.11.0부터 무기와 8부위도 바꾸고, 원본에 없는 무기와 8부위는 더한다.
   * 원본에 없던 엠블렘과 바꾼 원본 플래티넘 엠블렘의 상세는 최상위 `items`에 넣는다.
   */
  avatar?: readonly CharacterPayload[]
  /** 엔진 0.11.0부터 버프 강화 스킬의 절대 레벨이다. */
  buff?: Readonly<{ level: number }>
  /**
   * 엔진 0.9.0부터 `info`는 서약 본체, `set`은 서약 세트, `crystal`은 바꾼 결정이고 셋 다 선택이다.
   * 결정은 `slotNo`가 같은 원본 결정을 바꾸며, 0.8.0은 결정의 조율만 받는다.
   */
  oath?: Readonly<{
    info?: CharacterPayload
    set?: Readonly<{ setId: number }>
    crystal?: readonly CharacterPayload[]
    /** 엔진 0.10.0부터 바꾼 뒤의 묵언의 진의 전체를 1단계부터 차례로 담는다. */
    upgrade?: readonly Readonly<{ step: number; option: string }>[]
  }>
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
