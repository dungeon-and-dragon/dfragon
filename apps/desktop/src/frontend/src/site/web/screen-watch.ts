import type { DNFParticipantFrame } from '@dfragon/lib'

export type ScreenWatchKind = 'party' | 'raid'

export type NameCrops = readonly (DNFParticipantFrame | null)[]

export type ScreenWatchObservation = Readonly<{
  town: boolean
  kind: ScreenWatchKind
  crops: NameCrops | null
}>

export type ScreenWatchState = Readonly<{
  baselines: Readonly<Record<ScreenWatchKind, NameCrops | null>>
  candidate: Readonly<{ kind: ScreenWatchKind; crops: NameCrops }> | null
  roundRunning: boolean
}>

export type ScreenWatchSignal = 'none' | Readonly<{ kind: ScreenWatchKind }>

// #1076에서 화면 공유 프레임의 색은 원본과 채널마다 1~3 달랐다. 최대 3의 10배 남짓을 넘어야 바뀐
// 픽셀로 세어, 흔들림과 YUV 4:2:0 변환이 글자 가장자리에 남기는 차이는 세지 않는다.
const CHANGED_PIXEL_CHANNEL_DIFFERENCE = 32
// 1067×600 파티 이름 crop(73×16) 표본에서 글자 하나만 다른 이름은 평균 차이가 약 6이었고, 바뀐
// 글자는 수십 픽셀을 덮는다. 그보다 적은 수만 넘으면 같은 구성으로 둔다. 둘 다 실제 공유 프레임으로
// 맞춘 값은 아니어서 #1110에서 다시 본다.
const CHANGED_PIXELS_FOR_NEW_NAME = 10

export const initialScreenWatchState: ScreenWatchState = {
  baselines: { party: null, raid: null },
  candidate: null,
  roundRunning: false
}

export function observeScreenWatch(
  state: ScreenWatchState,
  observation: ScreenWatchObservation
): { state: ScreenWatchState; signal: ScreenWatchSignal } {
  const changed = state.roundRunning ? null : changedScreen(state, observation)
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
  return { ...state, baselines: { ...state.baselines, [kind]: crops }, candidate: null }
}

function changedScreen(
  state: ScreenWatchState,
  { town, kind, crops }: ScreenWatchObservation
): { kind: ScreenWatchKind; crops: NameCrops } | null {
  if (!town || crops == null) {
    return null
  }

  const baseline = state.baselines[kind]
  if (baseline != null && sameNameCrops(baseline, crops)) {
    return null
  }

  return { kind, crops }
}

function sameNameCrops(left: NameCrops, right: NameCrops): boolean {
  return (
    left.length === right.length && left.every((crop, index) => sameNameCrop(crop, right[index]))
  )
}

function sameNameCrop(
  left: DNFParticipantFrame | null,
  right: DNFParticipantFrame | null
): boolean {
  if (left == null || right == null) {
    return left == null && right == null
  }

  if (left.width !== right.width || left.height !== right.height) {
    return false
  }

  return countChangedPixels(left.rgba, right.rgba) < CHANGED_PIXELS_FOR_NEW_NAME
}

function countChangedPixels(
  left: DNFParticipantFrame['rgba'],
  right: DNFParticipantFrame['rgba']
): number {
  let changed = 0
  for (let index = 0; index < left.length; index += 4) {
    const difference = Math.max(
      Math.abs(left[index] - right[index]),
      Math.abs(left[index + 1] - right[index + 1]),
      Math.abs(left[index + 2] - right[index + 2])
    )
    if (difference > CHANGED_PIXEL_CHANNEL_DIFFERENCE) {
      changed += 1
    }
  }

  return changed
}
