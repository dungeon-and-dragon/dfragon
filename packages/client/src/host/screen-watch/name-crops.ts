import { detectPartyFrameGeometry, type DNFParticipantFrame, type DNFRectangle } from '@dfragon/lib'
import type { CharacterImage } from '@dfragon/client-core/types/character'
import { SEARCH_SLOT_COUNTS } from '@dfragon/client-core/types/search'
import {
  cropRaidWindowNicknames,
  type RaidWindowTemplates
} from '@dfragon/client-core/shared/raid/raid-window'
import type { NameCrops } from './screen-watch'

function copyRegion(frame: CharacterImage, region: DNFRectangle): DNFParticipantFrame {
  const { x, y, width, height } = region
  const rgba = new Uint8Array(width * height * 4)
  for (let line = 0; line < height; line += 1) {
    const start = ((y + line) * frame.width + x) * 4
    rgba.set(frame.rgba.subarray(start, start + width * 4), line * width * 4)
  }

  return { width, height, rgba }
}

export function readPartyNameCrops(frame: CharacterImage): NameCrops {
  const crops: (DNFParticipantFrame | null)[] = Array.from(
    { length: SEARCH_SLOT_COUNTS.party },
    () => null
  )
  for (const region of detectPartyFrameGeometry(frame).slots) {
    crops[region.slot - 1] = copyRegion(frame, region)
  }

  return crops
}

export function readRaidNameCrops(
  frame: CharacterImage,
  templates: RaidWindowTemplates
): NameCrops | null {
  const detection = cropRaidWindowNicknames(frame, templates)
  if (detection.status !== 'found') {
    return null
  }

  return detection.rows.map((row) => row.nicknameCrop)
}
