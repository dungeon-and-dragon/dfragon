import type { CtcCandidate } from '../lib/ctc-candidates'
import type { RaidValueColumn } from './search'
import type { CharacterImage } from './character'

export type CaptureSource = {
  id: string
  name: string
}

export type RaidFrameRow = Readonly<{
  nickname: CharacterImage
  job: CharacterImage | null
  valueText: string | null
}>

export type RaidFrameResult =
  | { kind: 'rows'; valueColumn: RaidValueColumn; rows: readonly (RaidFrameRow | null)[] }
  | { kind: 'missing'; reason: 'not-found' | 'uncertain' }

export type PartyOcrResult = {
  candidates: CtcCandidate[]
}

export type PartyOcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<PartyOcrResult>
  terminate: () => void
}

export type CapturePhase =
  | 'idle'
  | 'selecting'
  | 'selected'
  | 'recognizing'
  | 'complete'
  | 'unavailable'
  | 'failed'
