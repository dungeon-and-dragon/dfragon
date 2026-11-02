import type { DNFParticipantFrame } from '@dfragon/lib'
import { binarizeNicknamePixels, binarizeRaidNicknamePixels } from '../../lib/nickname-pixels'

export type ScreenWatchKind = 'party' | 'raid'

export type NameCrops = readonly (DNFParticipantFrame | null)[]

export type ScreenWatchObservation = Readonly<{
  town: boolean
  kind: ScreenWatchKind
  crops: NameCrops | null
}>

// 이진화한 RGBA다. 글자는 0, 배경은 255라 한 채널만 보아도 글자 여부가 갈린다.
type BinarizedCrop = Readonly<{ width: number; height: number; pixels: Uint8ClampedArray }>

type BinarizedCrops = readonly (BinarizedCrop | null)[]

export type ScreenWatchState = Readonly<{
  baselines: Readonly<Record<ScreenWatchKind, BinarizedCrops | null>>
  candidate: Readonly<{ kind: ScreenWatchKind; crops: BinarizedCrops }> | null
}>

export type ScreenWatchSignal = 'none' | Readonly<{ kind: ScreenWatchKind }>

// OCR이 그 화면의 닉네임에 쓰는 이진화를 같이 써, 움직이고 비치는 이름 칸 배경을 글자와 떼어 놓는다.
const binarizers: Readonly<
  Record<ScreenWatchKind, (data: Uint8ClampedArray, width: number, height: number) => void>
> = {
  party: binarizeNicknamePixels,
  raid: binarizeRaidNicknamePixels
}
// 글자 여부가 다른 픽셀은 같은 이름끼리 0개(2026-11-03 Windows 실기 공유 crop의 공대 노랑, 보라 배경 연속 프레임과
// 파티 표본), 서로 다른 공대 이름끼리 최소 79개(1067×600, 3840×2160 표본 526쌍)였다. 그 사이의 40개부터 다른 구성으로 본다.
const CHANGED_PIXELS_FOR_NEW_NAME = 40

export const initialScreenWatchState: ScreenWatchState = {
  baselines: { party: null, raid: null },
  candidate: null
}

export function observeScreenWatch(
  state: ScreenWatchState,
  observation: ScreenWatchObservation
): { state: ScreenWatchState; signal: ScreenWatchSignal } {
  const changed = changedScreen(state, observation)
  if (changed == null) {
    return { state: { ...state, candidate: null }, signal: 'none' }
  }

  if (
    state.candidate?.kind === changed.kind &&
    sameNameCrops(state.candidate.crops, changed.crops)
  ) {
    return { state: { ...state, candidate: null }, signal: { kind: changed.kind } }
  }

  return { state: { ...state, candidate: changed }, signal: 'none' }
}

export function recordScreenBaseline(
  state: ScreenWatchState,
  kind: ScreenWatchKind,
  crops: NameCrops
): ScreenWatchState {
  // 후보는 회차 전 기준으로 고른 것이라, 회차 앞뒤의 틱을 이어 2번으로 세지 않게 버린다.
  return {
    ...state,
    baselines: { ...state.baselines, [kind]: binarizeCrops(kind, crops) },
    candidate: null
  }
}

function changedScreen(
  state: ScreenWatchState,
  { town, kind, crops }: ScreenWatchObservation
): { kind: ScreenWatchKind; crops: BinarizedCrops } | null {
  if (!town || crops == null) {
    return null
  }

  const binarized = binarizeCrops(kind, crops)
  const baseline = state.baselines[kind]
  if (baseline != null && sameNameCrops(baseline, binarized)) {
    return null
  }

  return { kind, crops: binarized }
}

function binarizeCrops(kind: ScreenWatchKind, crops: NameCrops): BinarizedCrops {
  return crops.map((crop) => {
    if (crop == null) {
      return null
    }

    const { width, height } = crop
    const pixels = new Uint8ClampedArray(crop.rgba)
    binarizers[kind](pixels, width, height)

    return { width, height, pixels }
  })
}

function sameNameCrops(left: BinarizedCrops, right: BinarizedCrops): boolean {
  return (
    left.length === right.length && left.every((crop, index) => sameNameCrop(crop, right[index]))
  )
}

function sameNameCrop(left: BinarizedCrop | null, right: BinarizedCrop | null): boolean {
  if (left == null || right == null) {
    return left == null && right == null
  }

  if (left.width !== right.width || left.height !== right.height) {
    return false
  }

  return countChangedGlyphPixels(left.pixels, right.pixels) < CHANGED_PIXELS_FOR_NEW_NAME
}

function countChangedGlyphPixels(left: Uint8ClampedArray, right: Uint8ClampedArray): number {
  let changed = 0
  for (let index = 0; index < left.length; index += 4) {
    if (left[index] !== right[index]) {
      changed += 1
    }
  }

  return changed
}
