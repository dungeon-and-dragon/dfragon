import { binarizeNicknamePixels, binarizeRaidNicknamePixels } from '../../src/lib/nickname-pixels'
import { normalizedBgr, normalizedNicknameBgr } from '../../src/lib/paddle-recognition'
import type { DNFParticipantFrame } from '@dfragon/lib'
import { createOcrRecognizer } from '../shared/onnx-ocr'
import type { NicknameReads } from './evaluate'
import type { Screen } from './manifest'

export type NicknameReader = (crop: DNFParticipantFrame, screen: Screen) => Promise<NicknameReads>

const binarizers: Readonly<Record<Screen, typeof binarizeRaidNicknamePixels>> = {
  party: binarizeNicknamePixels,
  raid: binarizeRaidNicknamePixels
}

export async function createNicknameReader(
  modelPath: string,
  dictionaryPath: string
): Promise<NicknameReader> {
  const recognize = await createOcrRecognizer(modelPath, dictionaryPath)

  return async (crop, screen) => {
    const binarized = Uint8ClampedArray.from(crop.rgba)
    binarizers[screen](binarized, crop.width, crop.height)
    const nickname = await recognize(
      { width: crop.width, height: crop.height, rgba: binarized },
      normalizedNicknameBgr
    )
    const raw = await recognize(
      { width: crop.width, height: crop.height, rgba: Uint8ClampedArray.from(crop.rgba) },
      normalizedBgr
    )

    return { nickname, raw }
  }
}
