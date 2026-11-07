import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import type { DNFParticipantFrame } from '@dfragon/lib'
import type { CropRegion } from '../shared/onnx-ocr'
import { type CaseObservation, formatTable, type SlotObservation, summarize } from './evaluate'
import {
  loadCaseImage,
  type ManifestCase,
  type NicknameSlot,
  readManifest,
  SCREEN_SLOTS
} from './manifest'
import { createNicknameReader } from './nickname-ocr'
import { createScreenDetector } from './screen-detection'

const DEFAULT_OCR_MODEL = fileURLToPath(
  new URL('../../../models/ocr-finetuned/model.onnx', import.meta.url)
)
const DEFAULT_OCR_DICTIONARY = fileURLToPath(
  new URL('../../../models/ocr-finetuned/characters.txt', import.meta.url)
)

const manifestPath = process.env.DFRAGON_NICKNAME_MANIFEST
const reportPath = process.env.DFRAGON_NICKNAME_REPORT
const cropsDirectory = process.env.DFRAGON_NICKNAME_CROPS
const modelPath = process.env.DFRAGON_NICKNAME_OCR_MODEL || DEFAULT_OCR_MODEL
const dictionaryPath = process.env.DFRAGON_NICKNAME_OCR_DICTIONARY || DEFAULT_OCR_DICTIONARY

type CropIndexEntry = Readonly<{
  caseId: string
  screen: ManifestCase['screen']
  slot: NicknameSlot
  file: string
  scale: number
  crop: CropRegion
  client: ManifestCase['client']
  image: Readonly<{ width: number; height: number }>
  uiPercent: number | null
  capture: ManifestCase['capture']
}>

function writeCrop(directory: string, file: string, crop: DNFParticipantFrame): void {
  const png = new PNG({ width: crop.width, height: crop.height })
  png.data = Buffer.from(crop.rgba)
  writeFileSync(join(directory, file), PNG.sync.write(png))
}

describe.skipIf(manifestPath === undefined || manifestPath === '')(
  '닉네임 OCR 오프라인 평가',
  () => {
    it('표본마다 파티 프레임이나 공대 창을 검출하고 자리별 닉네임을 두 전처리로 읽어 정답과 비교한다', async () => {
      const manifest = readManifest(manifestPath as string)
      const detect = createScreenDetector()
      const reader = await createNicknameReader(modelPath, dictionaryPath)
      const saveCrops = cropsDirectory !== undefined && cropsDirectory !== ''
      if (saveCrops) {
        mkdirSync(cropsDirectory, { recursive: true })
      }
      const cropIndex: CropIndexEntry[] = []
      const cases: CaseObservation[] = []
      for (const entry of manifest.cases) {
        const frame = loadCaseImage(manifest, entry)
        const detection = detect(frame, entry.screen)
        const slots: SlotObservation[] = []
        for (const slot of SCREEN_SLOTS[entry.screen]) {
          const expected = entry.slots.find((labeled) => labeled.slot === slot)
          const detected = detection.crops.find((candidate) => candidate.slot === slot)
          if (detected === undefined) {
            if (expected !== undefined) {
              slots.push({
                slot,
                expected: expected.text,
                uncertain: expected.uncertain,
                read: null
              })
            }
            continue
          }

          if (saveCrops && detection.scale !== null) {
            const file = `${entry.id}_slot${slot}.png`
            writeCrop(cropsDirectory, file, detected.crop)
            cropIndex.push({
              caseId: entry.id,
              screen: entry.screen,
              slot,
              file,
              scale: detection.scale,
              crop: detected.region,
              client: entry.client,
              image: { width: frame.width, height: frame.height },
              uiPercent: entry.uiPercent,
              capture: entry.capture
            })
          }
          slots.push({
            slot,
            expected: expected?.text ?? null,
            uncertain: expected?.uncertain ?? false,
            read: await reader(detected.crop, entry.screen)
          })
        }
        cases.push({
          caseId: entry.id,
          screen: entry.screen,
          client: entry.client,
          uiPercent: entry.uiPercent,
          capture: entry.capture,
          scale: detection.scale,
          detectionFailure: detection.failure,
          slots
        })
      }
      const summary = summarize(cases)

      for (const entry of cases) {
        const scale = entry.scale !== null ? `s=${entry.scale.toFixed(2)}` : entry.detectionFailure
        console.log(`${entry.caseId}  ${entry.screen}  ${scale}`)
        for (const slot of entry.slots) {
          console.log(
            [
              entry.caseId,
              entry.screen,
              scale,
              `slot ${slot.slot}`,
              `expected ${JSON.stringify(slot.expected)}${slot.uncertain ? ' (uncertain)' : ''}`,
              `read ${JSON.stringify(slot.read)}`
            ].join('  ')
          )
        }
      }
      console.log(
        [
          formatTable('전체', { all: summary.overall }),
          formatTable('화면', summary.byScreen),
          formatTable('client, UI', summary.byClientUi),
          formatTable('s 구간', summary.byScale),
          formatTable('캡처', summary.byCapture)
        ].join('\n\n')
      )
      if (saveCrops) {
        writeFileSync(
          join(cropsDirectory, 'index.json'),
          `${JSON.stringify({ crops: cropIndex }, null, 2)}\n`
        )
      }

      if (reportPath !== undefined && reportPath !== '') {
        mkdirSync(dirname(reportPath), { recursive: true })
        writeFileSync(reportPath, `${JSON.stringify({ summary, cases }, null, 2)}\n`)
      }

      expect(cases).toHaveLength(manifest.cases.length)
    })
  }
)
