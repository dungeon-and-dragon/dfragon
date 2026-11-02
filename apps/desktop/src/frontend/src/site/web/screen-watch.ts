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
}>

export type ScreenWatchSignal = 'none' | Readonly<{ kind: ScreenWatchKind }>

// 잠정 값이다. #1076에서 색 패턴의 원본과 공유 결과는 채널마다 1~3 달랐고, 32는 그 흔들림을 넘는다.
// 글자 가장자리의 YUV 4:2:0 차이가 32 이하라는 근거는 없어 #1110에서 실제 공유 crop으로 다시 맞춘다.
const CHANGED_PIXEL_CHANNEL_DIFFERENCE = 32
// 잠정 값이다. 바뀐 픽셀이 10개 미만이면 같은 구성, 10개 이상이면 다른 구성이다. 73×16 이름 crop에서
// 글자 하나가 수십 픽셀을 바꾼다는 추정에서 정했고, 그중 채널 차이가 32를 넘는 픽셀이 10개 이상인지는
// 재지 않았다. #1110에서 같은 이름과 한 글자만 다른 이름의 실제 공유 crop으로 다시 맞춘다.
const CHANGED_PIXELS_FOR_NEW_NAME = 10

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
