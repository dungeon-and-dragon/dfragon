import { fileURLToPath } from 'node:url'
import {
  cropDNFRaidParticipantNicknames,
  type DNFParticipantFrame,
  detectPartyFrameGeometry,
  PartyFrameGeometryError
} from '@dfragon/lib'
import type { CharacterImage } from '../../src/preload/common/types/character'
import { type CropRegion, cropRegion } from '../shared/onnx-ocr'
import type { DetectionFailure } from './evaluate'
import { type NicknameSlot, readPng, type Screen } from './manifest'

const RAID_HEADING = fileURLToPath(
  new URL('../../src/shared/raid/raid-heading.png', import.meta.url)
)

export type NicknameCrop = Readonly<{
  slot: NicknameSlot
  region: CropRegion
  crop: DNFParticipantFrame
}>

export type ScreenDetection =
  | Readonly<{ scale: number; failure: null; crops: readonly NicknameCrop[] }>
  | Readonly<{ scale: null; failure: DetectionFailure; crops: readonly [] }>

export type ScreenDetector = (frame: CharacterImage, screen: Screen) => ScreenDetection

function detectParty(frame: CharacterImage): ScreenDetection {
  try {
    const geometry = detectPartyFrameGeometry(frame)
    const crops = geometry.slots.map((region) => ({
      slot: region.slot,
      region: { x: region.x, y: region.y, width: region.width, height: region.height },
      crop: cropRegion(frame, region)
    }))

    return { scale: geometry.scale, failure: null, crops }
  } catch (error) {
    if (error instanceof PartyFrameGeometryError) {
      return { scale: null, failure: error.reason, crops: [] }
    }
    throw error
  }
}

function detectRaid(frame: CharacterImage, heading: CharacterImage): ScreenDetection {
  const result = cropDNFRaidParticipantNicknames(frame, heading)
  if (result.status !== 'found') {
    return { scale: null, failure: result.status, crops: [] }
  }
  const crops = result.rows.flatMap(({ row, nickname, nicknameCrop }) => {
    if (nicknameCrop === null) {
      return []
    }

    return [{ slot: row, region: nickname, crop: nicknameCrop }]
  })

  return { scale: result.scale, failure: null, crops }
}

export function createScreenDetector(): ScreenDetector {
  const heading = readPng(RAID_HEADING)

  return (frame, screen) => {
    if (screen === 'party') {
      return detectParty(frame)
    }

    return detectRaid(frame, heading)
  }
}
