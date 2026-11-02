import { binarizeNicknamePixels } from '../../src/lib/nickname-pixels'
import { normalizedBgr, normalizedNicknameBgr } from '../../src/lib/paddle-recognition'
import type { CharacterImage } from '../../src/preload/common/types/character'
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
