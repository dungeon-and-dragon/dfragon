import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { PNG } from 'pngjs'
import type { PartyFrameSlot } from '@dfragon/lib'
import type { CharacterImage } from '../../src/preload/common/types/character'

export const CAPTURE_KINDS = ['prtsc', 'share', 'snip', 'ingame-jpg'] as const
export type CaptureKind = (typeof CAPTURE_KINDS)[number]

export const PARTY_SLOTS: readonly PartyFrameSlot[] = [1, 2, 3, 4]

export type ManifestSlot = Readonly<{ slot: PartyFrameSlot; text: string; uncertain: boolean }>

export type ClientSize = Readonly<{ width: number; height: number }>

export type ManifestCase = Readonly<{
  id: string
  image: string
  client: ClientSize
  uiPercent: number | null
  capture: CaptureKind
  slots: readonly ManifestSlot[]
}>

export type Manifest = Readonly<{ directory: string; cases: readonly ManifestCase[] }>

type JsonObject = Readonly<Record<string, unknown>>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(where: string, message: string): never {
  throw new TypeError(`manifest ${where}: ${message}`)
}

function readText(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    fail(where, '비어 있지 않은 문자열이어야 합니다')
  }

  return value
}

function readPositiveInteger(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    fail(where, '양의 정수여야 합니다')
  }

  return value
}

function parseClient(value: unknown, where: string): ClientSize {
  if (!isObject(value)) {
    fail(where, 'client는 { width, height } 객체여야 합니다')
  }

  return {
    width: readPositiveInteger(value.width, `${where}.width`),
    height: readPositiveInteger(value.height, `${where}.height`)
  }
}

function parseUiPercent(value: unknown, where: string): number | null {
  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    fail(where, 'uiPercent는 0~100의 정수나 null이어야 합니다')
  }

  return value
}

function parseSlot(value: unknown, where: string): ManifestSlot {
  if (!isObject(value)) {
    fail(where, '자리는 객체여야 합니다')
  }
  const slot = PARTY_SLOTS.find((candidate) => candidate === value.slot)
  if (slot === undefined) {
    fail(where, 'slot은 1~4의 정수여야 합니다')
  }

  if (value.uncertain !== undefined && typeof value.uncertain !== 'boolean') {
    fail(where, 'uncertain은 boolean이어야 합니다')
  }

  return { slot, text: readText(value.text, `${where}.text`), uncertain: value.uncertain === true }
}

function parseCase(value: unknown, where: string): ManifestCase {
  if (!isObject(value)) {
    fail(where, '케이스는 객체여야 합니다')
  }
  const image = readText(value.image, `${where}.image`)
  if (isAbsolute(image)) {
    fail(where, 'image는 manifest 폴더 기준 상대 경로여야 합니다')
  }

  if (!image.toLowerCase().endsWith('.png')) {
    fail(where, 'image는 PNG여야 합니다')
  }
  const capture = CAPTURE_KINDS.find((kind) => kind === value.capture)
  if (capture === undefined) {
    fail(where, `capture는 ${CAPTURE_KINDS.join(', ')} 중 하나여야 합니다`)
  }

  if (!Array.isArray(value.slots)) {
    fail(where, 'slots는 배열이어야 합니다')
  }
  const slots = value.slots.map((slot, index) => parseSlot(slot, `${where}.slots[${index}]`))
  if (new Set(slots.map((entry) => entry.slot)).size !== slots.length) {
    fail(where, '자리 번호가 중복됩니다')
  }

  return {
    id: readText(value.id, `${where}.id`),
    image,
    client: parseClient(value.client, `${where}.client`),
    uiPercent: parseUiPercent(value.uiPercent, `${where}.uiPercent`),
    capture,
    slots
  }
}

export function parseManifest(directory: string, json: unknown): Manifest {
  if (!isObject(json) || !Array.isArray(json.cases) || json.cases.length === 0) {
    fail('root', 'cases는 비어 있지 않은 배열이어야 합니다')
  }
  const cases = json.cases.map((entry, index) => parseCase(entry, `cases[${index}]`))
  if (new Set(cases.map((entry) => entry.id)).size !== cases.length) {
    fail('root', '케이스 id가 중복됩니다')
  }

  return { directory, cases }
}

export function readManifest(file: string): Manifest {
  const path = resolve(file)

  return parseManifest(dirname(path), JSON.parse(readFileSync(path, 'utf8')))
}

export function loadCaseImage(manifest: Manifest, entry: ManifestCase): CharacterImage {
  const resolved = resolve(manifest.directory, entry.image)
  const fromRoot = relative(manifest.directory, resolved)
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new RangeError(`manifest 경로가 표본 폴더 밖을 가리킵니다: ${entry.image}`)
  }
  const png = PNG.sync.read(readFileSync(resolved))

  return { width: png.width, height: png.height, rgba: new Uint8Array(png.data) }
}
