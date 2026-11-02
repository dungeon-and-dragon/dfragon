import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import {
  detectPartyFrameGeometry,
  type PartyFrameGeometry,
  PartyFrameGeometryError,
  type PartyFrameGeometryFailureReason,
  type PartyFrameRegion
} from '@dfragon/lib'
import type { CharacterImage } from '../../src/preload/common/types/character'
import { type CropRegion, cropRegion } from '../shared/onnx-ocr'
import { type CaseObservation, formatTable, type SlotObservation, summarize } from './evaluate'
import { loadCaseImage, type ManifestCase, PARTY_SLOTS, readManifest } from './manifest'
import { createNicknameReader } from './nickname-ocr'

const DEFAULT_OCR_MODEL = fileURLToPath(
  new URL('../../../models/ocr-finetuned/model.onnx', import.meta.url)
)
const DEFAULT_OCR_DICTIONARY = fileURLToPath(
  new URL('../../../models/ocr-finetuned/characters.txt', import.meta.url)
)

const manifestPath = process.env.DFRAGON_PARTY_NICKNAME_MANIFEST
const reportPath = process.env.DFRAGON_PARTY_NICKNAME_REPORT
const cropsDirectory = process.env.DFRAGON_PARTY_NICKNAME_CROPS
const modelPath = process.env.DFRAGON_PARTY_NICKNAME_OCR_MODEL || DEFAULT_OCR_MODEL
const dictionaryPath = process.env.DFRAGON_PARTY_NICKNAME_OCR_DICTIONARY || DEFAULT_OCR_DICTIONARY

type CropIndexEntry = Readonly<{
  caseId: string
  slot: PartyFrameRegion['slot']
  file: string
  scale: number
  crop: CropRegion
  client: ManifestCase['client']
  image: Readonly<{ width: number; height: number }>
  uiPercent: number | null
  capture: ManifestCase['capture']
}>

type Detection =
  | Readonly<{ geometry: PartyFrameGeometry; failure: null }>
  | Readonly<{ geometry: null; failure: PartyFrameGeometryFailureReason }>

function detect(frame: CharacterImage): Detection {
  try {
    return { geometry: detectPartyFrameGeometry(frame), failure: null }
  } catch (error) {
    if (error instanceof PartyFrameGeometryError) {
      return { geometry: null, failure: error.reason }
    }
    throw error
  }
}

function writeCrop(directory: string, file: string, crop: CharacterImage): void {
  const png = new PNG({ width: crop.width, height: crop.height })
  png.data = Buffer.from(crop.rgba)
  writeFileSync(join(directory, file), PNG.sync.write(png))
}

describe.skipIf(manifestPath === undefined || manifestPath === '')(
  '파티 닉네임 OCR 오프라인 평가',
  () => {
    it('표본마다 파티 프레임을 검출하고 자리별 닉네임을 두 전처리로 읽어 정답과 비교한다', async () => {
      const manifest = readManifest(manifestPath as string)
      const reader = await createNicknameReader(modelPath, dictionaryPath)
      const saveCrops = cropsDirectory !== undefined && cropsDirectory !== ''
      if (saveCrops) {
        mkdirSync(cropsDirectory, { recursive: true })
      }
      const cropIndex: CropIndexEntry[] = []
      const cases: CaseObservation[] = []
      for (const entry of manifest.cases) {
        const frame = loadCaseImage(manifest, entry)
        const { geometry, failure } = detect(frame)
        const slots: SlotObservation[] = []
        for (const slot of PARTY_SLOTS) {
          const expected = entry.slots.find((labeled) => labeled.slot === slot)
          const region = geometry?.slots.find((detected) => detected.slot === slot)
          if (region === undefined) {
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
          const crop = cropRegion(frame, region)
          if (saveCrops && geometry !== null) {
            const file = `${entry.id}_slot${slot}.png`
            writeCrop(cropsDirectory, file, crop)
            cropIndex.push({
              caseId: entry.id,
              slot,
              file,
              scale: geometry.scale,
              crop: { x: region.x, y: region.y, width: region.width, height: region.height },
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
            read: await reader(crop)
          })
        }
        cases.push({
          caseId: entry.id,
          client: entry.client,
          uiPercent: entry.uiPercent,
          capture: entry.capture,
          scale: geometry?.scale ?? null,
          detectionFailure: failure,
          slots
        })
      }
      const summary = summarize(cases)

      for (const entry of cases) {
        const scale = entry.scale !== null ? `s=${entry.scale.toFixed(2)}` : entry.detectionFailure
        console.log(`${entry.caseId}  ${scale}`)
        for (const slot of entry.slots) {
          console.log(
            [
              entry.caseId,
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
