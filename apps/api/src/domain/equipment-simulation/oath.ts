import { findOathCrystal } from '@dfragon/lib/equipment-variants'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import { EquipmentSimulationFailure } from './failure.js'

export interface OathTuneChange {
  readonly slotNo: number
  readonly tune: number
}

export interface OathTuneEdit {
  readonly original: CharacterPayload
  readonly level: number
  readonly setPoint: number
}

function wornCrystals(oath: CharacterPayload): CharacterPayload[] {
  const section = oath.oath

  if (!isRecord(section) || !Array.isArray(section.crystal)) {
    throw new EquipmentSimulationFailure('request')
  }

  return section.crystal.filter(isRecord)
}

function editOf(crystals: readonly CharacterPayload[], change: OathTuneChange): OathTuneEdit {
  const original = crystals.find((crystal) => crystal.slotNo === change.slotNo)

  if (original === undefined || typeof original.itemName !== 'string') {
    throw new EquipmentSimulationFailure('request')
  }

  const setPoint = findOathCrystal(original.itemName)?.tuneSetPoints[change.tune]

  if (setPoint === undefined) {
    throw new EquipmentSimulationFailure('request')
  }

  return { original, level: change.tune, setPoint }
}

/** 서약이 없는 캐릭터, 원본에 없는 슬롯, 조율 단계를 모르는 결정과 그 결정의 단계 밖 조율은 거절한다. */
export function editOathTunes(
  oath: CharacterPayload,
  changes: readonly OathTuneChange[]
): OathTuneEdit[] {
  if (changes.length === 0) {
    return []
  }

  const crystals = wornCrystals(oath)

  return changes.map((change) => editOf(crystals, change))
}

/** 원본 결정을 깊은 복사해 조율 단계와 그 단계의 세트 포인트만 바꾼다. */
export function simulatedCrystals(edits: readonly OathTuneEdit[]): CharacterPayload[] {
  return edits.map(({ original, level, setPoint }) => {
    const crystal = structuredClone(original)
    const tune = isRecord(crystal.tune) ? crystal.tune : {}
    crystal.tune = { ...tune, level, setPoint }

    return crystal
  })
}
