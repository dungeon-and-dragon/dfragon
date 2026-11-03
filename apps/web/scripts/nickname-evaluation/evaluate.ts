import type { DNFRaidParticipantCropResult, PartyFrameGeometryFailureReason } from '@dfragon/lib'
import type { CaptureKind, ClientSize, NicknameSlot, Screen } from './manifest'

export const NICKNAME_PREPROCESSINGS = ['nickname', 'raw'] as const
export type NicknamePreprocessing = (typeof NICKNAME_PREPROCESSINGS)[number]

export type NicknameReads = Readonly<Record<NicknamePreprocessing, string>>

const SCALE_BIN_WIDTH = 0.1
const UNDETECTED_SCALE_BIN = 'undetected'

export type RaidDetectionFailure = Exclude<DNFRaidParticipantCropResult['status'], 'found'>

export type DetectionFailure = PartyFrameGeometryFailureReason | RaidDetectionFailure

export type SlotObservation = Readonly<{
  slot: NicknameSlot
  expected: string | null
  uncertain: boolean
  read: NicknameReads | null
}>

export type CaseObservation = Readonly<{
  caseId: string
  screen: Screen
  client: ClientSize
  uiPercent: number | null
  capture: CaptureKind
  scale: number | null
  detectionFailure: DetectionFailure | null
  slots: readonly SlotObservation[]
}>

export type RecognitionMetrics = Readonly<{
  slots: number
  exact: number
  editDistance: number
  characters: number
  cer: number | null
}>

export type GroupSummary = Readonly<{
  cases: number
  detectedCases: number
  labeledSlots: number
  uncertainSlots: number
  missingSlots: number
  recognition: Readonly<Record<NicknamePreprocessing, RecognitionMetrics>>
}>

export type EvaluationSummary = Readonly<{
  overall: GroupSummary
  byScreen: Readonly<Record<string, GroupSummary>>
  byClientUi: Readonly<Record<string, GroupSummary>>
  byScale: Readonly<Record<string, GroupSummary>>
  byCapture: Readonly<Record<string, GroupSummary>>
}>

/** dfragon-ocr-eval-tool `recognition/distance.py`와 같이 정규화 없이 code point 단위로 센다. */
export function editDistance(expected: string, actual: string): number {
  const actualCharacters = [...actual]
  let previous = Array.from({ length: actualCharacters.length + 1 }, (_, index) => index)
  let row = 0
  for (const expectedCharacter of expected) {
    row += 1
    const current = [row]
    for (let column = 1; column <= actualCharacters.length; column += 1) {
      current.push(
        Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (expectedCharacter === actualCharacters[column - 1] ? 0 : 1)
        )
      )
    }
    previous = current
  }

  return previous[actualCharacters.length]
}

export function scaleBin(scale: number | null): string {
  if (scale === null) {
    return UNDETECTED_SCALE_BIN
  }
  // 검출 배율은 0.01 격자라 부동소수 오차로 1.1이 1.0 구간에 들어가지 않게 백분율 정수로 나눈다.
  const percent = Math.round(scale * 100)
  const binPercent = percent - (percent % Math.round(SCALE_BIN_WIDTH * 100))

  return (binPercent / 100).toFixed(1)
}

export function clientUiKey(client: ClientSize, uiPercent: number | null): string {
  const ui = uiPercent ?? '?'

  return `${client.width}x${client.height} ui${ui}`
}

function recognitionMetrics(
  slots: readonly SlotObservation[],
  preprocessing: NicknamePreprocessing
): RecognitionMetrics {
  let exact = 0
  let distance = 0
  let characters = 0
  for (const slot of slots) {
    if (slot.expected === null || slot.read === null) {
      continue
    }
    const read = slot.read[preprocessing]
    exact += read === slot.expected ? 1 : 0
    distance += editDistance(slot.expected, read)
    characters += [...slot.expected].length
  }

  const cer = characters !== 0 ? distance / characters : null

  return { slots: slots.length, exact, editDistance: distance, characters, cer }
}

function groupSummary(cases: readonly CaseObservation[]): GroupSummary {
  const labeled = cases.flatMap((entry) => entry.slots.filter((slot) => slot.expected !== null))
  const scored = labeled.filter((slot) => !slot.uncertain && slot.read !== null)
  const detectedCases = cases.filter((entry) => entry.scale !== null).length
  const uncertainSlots = labeled.filter((slot) => slot.uncertain).length
  const missingSlots = labeled.filter((slot) => !slot.uncertain && slot.read === null).length

  return {
    cases: cases.length,
    detectedCases,
    labeledSlots: labeled.length,
    uncertainSlots,
    missingSlots,
    recognition: {
      nickname: recognitionMetrics(scored, 'nickname'),
      raw: recognitionMetrics(scored, 'raw')
    }
  }
}

function groupBy(
  cases: readonly CaseObservation[],
  key: (entry: CaseObservation) => string
): Record<string, GroupSummary> {
  const groups = new Map<string, CaseObservation[]>()
  for (const entry of cases) {
    const name = key(entry)
    groups.set(name, [...(groups.get(name) ?? []), entry])
  }
  const names = [...groups.keys()].sort()

  return Object.fromEntries(names.map((name) => [name, groupSummary(groups.get(name) ?? [])]))
}

export function summarize(cases: readonly CaseObservation[]): EvaluationSummary {
  return {
    overall: groupSummary(cases),
    byScreen: groupBy(cases, (entry) => entry.screen),
    byClientUi: groupBy(cases, (entry) => clientUiKey(entry.client, entry.uiPercent)),
    byScale: groupBy(cases, (entry) => scaleBin(entry.scale)),
    byCapture: groupBy(cases, (entry) => entry.capture)
  }
}

function formatRate(metrics: RecognitionMetrics): string {
  return `${metrics.exact}/${metrics.slots}`
}

function formatCer(metrics: RecognitionMetrics): string {
  if (metrics.cer === null) {
    return '-'
  }

  return metrics.cer.toFixed(3)
}

export function formatTable(title: string, groups: Readonly<Record<string, GroupSummary>>): string {
  const header = [
    title,
    '케이스',
    '검출',
    '채점 자리',
    '불확실',
    '자리 미검출',
    'nickname 일치',
    'nickname CER',
    'raw 일치',
    'raw CER'
  ]
  const rows = Object.entries(groups).map(([name, group]) => [
    name,
    String(group.cases),
    String(group.detectedCases),
    String(group.recognition.nickname.slots),
    String(group.uncertainSlots),
    String(group.missingSlots),
    formatRate(group.recognition.nickname),
    formatCer(group.recognition.nickname),
    formatRate(group.recognition.raw),
    formatCer(group.recognition.raw)
  ])

  return [header, header.map(() => '---'), ...rows]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n')
}
