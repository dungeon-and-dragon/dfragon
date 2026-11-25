type EngineVersion = readonly [number, number, number]

// 그 전 엔진은 바꾸지 않은 점수를 바꾼 점수로 내거나 입력을 거부한다.
const SLOT_ITEM_ENGINE_VERSION: EngineVersion = [0, 6, 0]
const EQUIPMENT_ITEM_ENGINE_VERSION: EngineVersion = [0, 7, 0]
const OATH_TUNE_ENGINE_VERSION: EngineVersion = [0, 8, 0]
const SET_ENGINE_VERSION: EngineVersion = [0, 9, 0]
const OATH_UPGRADE_ENGINE_VERSION: EngineVersion = [0, 10, 0]
const BUFF_LEVEL_ENGINE_VERSION: EngineVersion = [0, 11, 0]
// 0.11.0은 피부 엠블렘을 바꾸지 못해 끝 스펙의 피부 엠블렘이 빠진 점수를 낸다.
const AVATAR_ENGINE_VERSION: EngineVersion = [0, 12, 0]
const WEAPON_ITEM_ENGINE_VERSION: EngineVersion = [0, 13, 0]
const SWITCHING_EQUIPMENT_ENGINE_VERSION: EngineVersion = [0, 14, 0]
// 0.15.0부터 응답에 서약 세트가 없으면 엔진이 세트 포인트 합이 가장 큰 세트로 서약 세트 상태를 만든다.
const INFERRED_OATH_SET_ENGINE_VERSION: EngineVersion = [0, 15, 0]
// 0.16.0부터 원본에 없는 장비, 칭호, 크리쳐, 오라를 더할 수 있다.
const ADDED_SLOT_ENGINE_VERSION: EngineVersion = [0, 16, 0]
const ENGINE_VERSION_PATTERN = /(\d+)\.(\d+)\.(\d+)/

export interface SimulationFeatures {
  /** 칭호, 크리쳐, 오라 교체 */
  readonly slotItems: boolean
  /** 무기를 뺀 11부위의 아이템, 조율, 정밀도 변경 */
  readonly equipmentItems: boolean
  readonly oathTunes: boolean
  readonly equipmentSet: boolean
  readonly weaponTune: boolean
  /** 무기 아이템과 해방 수치 변경 */
  readonly weaponItem: boolean
  /** 비어 있는 장비, 칭호, 크리쳐, 오라 부위에 아이템을 더함 */
  readonly addedSlots: boolean
  /** 서약 세트, 본체, 결정 아이템 교체 */
  readonly oathItems: boolean
  /** 묵언의 진의 단계와 선택지 변경 */
  readonly oathUpgrade: boolean
  /** 버프 강화 스킬 레벨 변경 */
  readonly buffLevel: boolean
  /** 버프 강화 장비에 등록한 유니크 스위칭 장비 수 변경 */
  readonly switchingEquipment: boolean
  /** 무기와 8부위 아바타, 피부와 오라 엠블렘 변경 */
  readonly avatar: boolean
  /** 원본 응답에 서약 세트가 없는 캐릭터의 서약 변경 */
  readonly oathWithoutSetInfo: boolean
}

function versionOf(engine: string): number[] | null {
  const matched = ENGINE_VERSION_PATTERN.exec(engine)

  if (matched === null) {
    return null
  }

  return matched.slice(1).map(Number)
}

function isAtLeast(version: readonly number[], minimum: EngineVersion): boolean {
  for (const [index, part] of minimum.entries()) {
    const own = version[index]!

    if (own !== part) {
      return own > part
    }
  }

  return true
}

function minimumVersions(features: SimulationFeatures): EngineVersion[] {
  const minimums: EngineVersion[] = []

  if (features.slotItems) {
    minimums.push(SLOT_ITEM_ENGINE_VERSION)
  }

  if (features.equipmentItems) {
    minimums.push(EQUIPMENT_ITEM_ENGINE_VERSION)
  }

  if (features.oathTunes) {
    minimums.push(OATH_TUNE_ENGINE_VERSION)
  }

  if (features.equipmentSet || features.weaponTune || features.oathItems) {
    minimums.push(SET_ENGINE_VERSION)
  }

  if (features.oathUpgrade) {
    minimums.push(OATH_UPGRADE_ENGINE_VERSION)
  }

  if (features.buffLevel) {
    minimums.push(BUFF_LEVEL_ENGINE_VERSION)
  }

  if (features.avatar) {
    minimums.push(AVATAR_ENGINE_VERSION)
  }

  if (features.weaponItem) {
    minimums.push(WEAPON_ITEM_ENGINE_VERSION)
  }

  if (features.switchingEquipment) {
    minimums.push(SWITCHING_EQUIPMENT_ENGINE_VERSION)
  }

  if (features.oathWithoutSetInfo) {
    minimums.push(INFERRED_OATH_SET_ENGINE_VERSION)
  }

  if (features.addedSlots) {
    minimums.push(ADDED_SLOT_ENGINE_VERSION)
  }

  return minimums
}

/** `versions.package`("dnfscore-native X.Y.Z")가 요청에 든 변경을 모두 반영하는 엔진인지 본다. */
export function supportsSimulation(enginePackage: string, features: SimulationFeatures): boolean {
  const minimums = minimumVersions(features)

  if (minimums.length === 0) {
    return true
  }

  const version = versionOf(enginePackage)

  if (version === null) {
    return false
  }

  return minimums.every((minimum) => isAtLeast(version, minimum))
}
