import { binarizeNicknamePixels } from '../../src/core/ocr/nickname-pixels'
import { normalizedBgr, normalizedNicknameBgr } from '../../src/core/ocr/paddle-recognition'
import type { CharacterImage } from '../../src/core/character/character'
import { createOcrRecognizer } from '../shared/onnx-ocr'
import type { NicknameReads } from './evaluate'

export type NicknameReader = (crop: CharacterImage) => Promise<NicknameReads>

export async function createNicknameReader(
  modelPath: string,
  dictionaryPath: string
): Promise<NicknameReader> {
  const recognize = await createOcrRecognizer(modelPath, dictionaryPath)

  return async (crop) => {
    const binarized = Uint8ClampedArray.from(crop.rgba)
    binarizeNicknamePixels(binarized)
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
