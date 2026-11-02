import { binarizeRaidTextPixels } from '../../src/core/ocr/nickname-pixels'
import { normalizedBgr, normalizedNicknameBgr } from '../../src/core/ocr/paddle-recognition'
import type { CharacterImage } from '../../src/core/character/character'
import { createOcrRecognizer } from '../shared/onnx-ocr'
import type { JobOcrPreprocessing } from './evaluate'

export type JobOcrReader = (
  crop: CharacterImage,
  preprocessing: JobOcrPreprocessing
) => Promise<string>

export async function createJobOcrReader(
  modelPath: string,
  dictionaryPath: string
): Promise<JobOcrReader> {
  const recognize = await createOcrRecognizer(modelPath, dictionaryPath)

  return (crop, preprocessing) => {
    const pixels = Uint8ClampedArray.from(crop.rgba)
    if (preprocessing === 'nickname') {
      binarizeRaidTextPixels(pixels)
    }
    const normalize = preprocessing === 'nickname' ? normalizedNicknameBgr : normalizedBgr

    return recognize({ width: crop.width, height: crop.height, rgba: pixels }, normalize)
  }
}
