import type { DNFParticipantFrame } from '@dfragon/lib'

export type ScreenWatchKind = 'party' | 'raid'

export type NameCrops = readonly (DNFParticipantFrame | null)[]

export type ScreenWatchObservation = Readonly<{
  town: boolean
  raid: NameCrops | null
  party: NameCrops | null
}>

export type ScreenWatchState = Readonly<{
  baselines: Readonly<Record<ScreenWatchKind, NameCrops | null>>
  candidate: Readonly<{ kind: ScreenWatchKind; crops: NameCrops }> | null
  roundRunning: boolean
}>

export type ScreenWatchSignal = 'none' | Readonly<{ kind: ScreenWatchKind }>

// #1076에서 화면 공유 프레임의 색은 원본과 채널마다 1~3 달랐다. YUV 4:2:0 변환이 글자 가장자리를
// 더 흔들 몫까지 그 최대값의 두 배로 받는다. 실제 이름 crop으로 맞춘 값은 아니어서 #1110에서 다시 본다.
const SAME_CROP_MEAN_RGB_DIFFERENCE = 6

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
  { town, raid, party }: ScreenWatchObservation
): { kind: ScreenWatchKind; crops: NameCrops } | null {
  if (!town) {
    return null
  }
  const [kind, crops] = raid != null ? (['raid', raid] as const) : (['party', party] as const)
  if (crops == null) {
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

  return meanRgbDifference(left.rgba, right.rgba) <= SAME_CROP_MEAN_RGB_DIFFERENCE
}

function meanRgbDifference(
  left: DNFParticipantFrame['rgba'],
  right: DNFParticipantFrame['rgba']
): number {
  let total = 0
  for (let index = 0; index < left.length; index += 4) {
    for (let channel = index; channel < index + 3; channel += 1) {
      total += Math.abs(left[channel] - right[channel])
    }
  }

  return total / ((left.length / 4) * 3)
}
