import type { DNFParticipantFrame } from '@dfragon/lib'
import { expect, it } from 'vitest'
import {
  initialScreenWatchState,
  observeScreenWatch,
  recordScreenBaseline,
  type NameCrops,
  type ScreenWatchKind,
  type ScreenWatchObservation,
  type ScreenWatchSignal,
  type ScreenWatchState
} from './screen-watch'

// 이름 crop 대신 한 색으로 채운 합성 crop을 쓴다. 색 값이 곧 이름 구성의 차이를 나타낸다.
function crop(gray: number, width = 8, height = 4): DNFParticipantFrame {
  const rgba = new Uint8Array(width * height * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba.set([gray, gray, gray, 255], index)
  }

  return { width, height, rgba }
}

function shiftPixels(
  source: DNFParticipantFrame,
  pixels: number[],
  delta: (pixel: number) => readonly number[]
): DNFParticipantFrame {
  const rgba = Uint8Array.from(source.rgba)
  for (const pixel of pixels) {
    delta(pixel).forEach((value, channel) => {
      rgba[pixel * 4 + channel] += value
    })
  }

  return { ...source, rgba }
}

function firstPixels(count: number): number[] {
  return Array.from({ length: count }, (_, pixel) => pixel)
}

function allPixels(source: DNFParticipantFrame): number[] {
  return firstPixels(source.width * source.height)
}

const partyA: NameCrops = [crop(10), crop(80), null, null]
const partyB: NameCrops = [crop(10), crop(150), null, null]
const partyC: NameCrops = [crop(10), crop(220), null, null]
const raidA: NameCrops = [crop(30), crop(100), crop(170)]

function party(crops: NameCrops | null, town = true): ScreenWatchObservation {
  return { town, kind: 'party', crops }
}

function raid(crops: NameCrops | null): ScreenWatchObservation {
  return { town: true, kind: 'raid', crops }
}

function watch(
  ticks: ScreenWatchObservation[],
  start: ScreenWatchState = initialScreenWatchState
): { state: ScreenWatchState; signals: ScreenWatchSignal[] } {
  let state = start
  const signals = ticks.map((tick) => {
    const result = observeScreenWatch(state, tick)
    state = result.state

    return result.signal
  })

  return { state, signals }
}

function withBaselines(baselines: Partial<Record<ScreenWatchKind, NameCrops>>): ScreenWatchState {
  let state = initialScreenWatchState
  if (baselines.party != null) {
    state = recordScreenBaseline(state, 'party', baselines.party)
  }

  if (baselines.raid != null) {
    state = recordScreenBaseline(state, 'raid', baselines.raid)
  }

  return state
}

function partyTwiceAgainst(
  baseline: DNFParticipantFrame,
  observed: DNFParticipantFrame
): ScreenWatchSignal[] {
  const state = withBaselines({ party: [baseline] })

  return watch([party([observed]), party([observed])], state).signals
}

const NO_START = ['none', 'none']
const STARTS_PARTY = ['none', { kind: 'party' }]

it('마을이 아니면 새 구성이 보여도 시작하지 않고, 그 틱은 연속 횟수를 끊는다', () => {
  expect(watch([party(partyB, false), party(partyB, false)]).signals).toEqual(NO_START)
  expect(watch([party(partyB), party(partyB, false), party(partyB)]).signals).toEqual([
    'none',
    'none',
    'none'
  ])
})

it('지금 화면의 crop은 그 화면의 기준하고만 비교한다', () => {
  const state = withBaselines({ party: partyA, raid: raidA })

  expect(watch([raid(partyA), raid(partyA)], state).signals).toEqual(['none', { kind: 'raid' }])
  expect(watch([party(raidA), party(raidA)], state).signals).toEqual(STARTS_PARTY)
  expect(watch([raid(raidA), raid(raidA)], state).signals).toEqual(NO_START)
})

it('화면이 바뀌면 다른 화면의 후보를 이어 세지 않는다', () => {
  expect(watch([party(partyB), raid(partyB), party(partyB)]).signals).toEqual([
    'none',
    'none',
    'none'
  ])
})

it('그 화면의 회차가 없었으면 처음 보인 구성도 2번 연속이면 시작한다', () => {
  expect(watch([party(partyA), party(partyA)]).signals).toEqual(STARTS_PARTY)
})

it('기준과 같은 구성이 계속 보이면 시작하지 않는다', () => {
  expect(watch([party(partyA), party(partyA)], withBaselines({ party: partyA })).signals).toEqual(
    NO_START
  )
})

it('채널 차이가 32 이하인 픽셀은 바뀐 픽셀로 세지 않고, 33부터 센다', () => {
  const base = crop(100)

  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, allPixels(base), () => [32, 32, 32])
    )
  ).toEqual(NO_START)
  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, allPixels(base), () => [33, 0, 0])
    )
  ).toEqual(STARTS_PARTY)
})

it('바뀐 픽셀이 9개면 같은 구성, 10개면 다른 구성으로 본다', () => {
  const base = crop(100)

  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, firstPixels(9), () => [33, 33, 33])
    )
  ).toEqual(NO_START)
  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, firstPixels(10), () => [33, 33, 33])
    )
  ).toEqual(STARTS_PARTY)
})

it('세 채널 중 하나만 크게 달라도 바뀐 픽셀로 센다', () => {
  const base = crop(100)

  for (const delta of [
    [60, 0, 0],
    [0, 60, 0],
    [0, 0, -60]
  ]) {
    expect(
      partyTwiceAgainst(
        base,
        shiftPixels(base, allPixels(base), () => delta)
      )
    ).toEqual(STARTS_PARTY)
  }
})

it('채널 차이의 부호가 섞여 합하면 0이어도 바뀐 픽셀로 센다', () => {
  const base = crop(100)

  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, allPixels(base), () => [40, -40, 0])
    )
  ).toEqual(STARTS_PARTY)
})

it('alpha만 다른 crop은 같은 구성으로 본다', () => {
  const base = crop(100)

  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, allPixels(base), () => [0, 0, 0, -255])
    )
  ).toEqual(NO_START)
})

it('이름 crop 전체에 고르게 퍼진 1~3 흔들림은 같은 구성으로 남는다', () => {
  const base = crop(100, 73, 16)
  const jitter = [
    [1, -2, 3],
    [-3, 1, -1],
    [2, 3, -2]
  ]

  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, allPixels(base), (pixel) => jitter[pixel % 3])
    )
  ).toEqual(NO_START)
})

// 73×16 crop에서 48픽셀을 100씩 바꾸면 RGB 평균 차이는 약 4라, 평균 6 기준이었다면 놓치는 변화다.
it('글자 하나 크기만큼 국소적으로 바뀌면 나머지가 같아도 다른 구성으로 본다', () => {
  const base = crop(40, 73, 16)
  const glyph = Array.from(
    { length: 6 * 8 },
    (_, index) => 60 + Math.floor(index / 6) * 73 + (index % 6)
  )

  expect(
    partyTwiceAgainst(
      base,
      shiftPixels(base, glyph, () => [100, 100, 100])
    )
  ).toEqual(STARTS_PARTY)
})

it('자리 수나 빈 자리가 달라지면 같은 crop이 남아 있어도 다른 구성으로 본다', () => {
  const state = withBaselines({ party: [crop(10), null] })
  const twice = (crops: NameCrops) => watch([party(crops), party(crops)], state).signals

  expect(twice([crop(10), null])).toEqual(NO_START)
  expect(twice([crop(10), null, null])).toEqual(STARTS_PARTY)
  expect(twice([crop(10), crop(10)])).toEqual(STARTS_PARTY)
  expect(twice([null, null])).toEqual(STARTS_PARTY)
})

it('한 자리라도 crop 폭이나 높이가 다르면 색이 같아도 다른 구성으로 본다', () => {
  expect(partyTwiceAgainst(crop(20), crop(20, 9, 4))).toEqual(STARTS_PARTY)
  expect(partyTwiceAgainst(crop(20), crop(20, 8, 5))).toEqual(STARTS_PARTY)

  const state = withBaselines({ party: [crop(10), crop(20)] })
  const resized = [crop(10), crop(20, 8, 5)]

  expect(watch([party(resized), party(resized)], state).signals).toEqual(STARTS_PARTY)
})

it('새 구성은 2번 연속 같아야 시작하고, 사이에 다른 프레임이 끼면 다시 센다', () => {
  const state = withBaselines({ party: partyA })

  expect(watch([party(partyB), party(partyA), party(partyB)], state).signals).toEqual([
    'none',
    'none',
    'none'
  ])
  expect(watch([party(partyB), party(partyC), party(partyC)], state).signals).toEqual([
    'none',
    'none',
    { kind: 'party' }
  ])
})

it('새 구성 사이에 그 화면을 찾지 못한 틱이 끼면 다시 센다', () => {
  const state = withBaselines({ party: partyA })

  expect(watch([party(partyB), party(null), party(partyB)], state).signals).toEqual([
    'none',
    'none',
    'none'
  ])
})

it('기준과 다른 두 관측이 서로 허용 범위 안이면 시작한다', () => {
  const nearB = partyB.map((name) => name && shiftPixels(name, firstPixels(9), () => [33, 33, 33]))

  expect(watch([party(partyB), party(nearB)], withBaselines({ party: partyA })).signals).toEqual(
    STARTS_PARTY
  )
})

it('시작 신호를 낸 뒤에는 다음 시작에도 2번 연속이 다시 필요하다', () => {
  const ticks = [partyB, partyB, partyB].map((crops) => party(crops))

  expect(watch(ticks, withBaselines({ party: partyA })).signals).toEqual([
    'none',
    { kind: 'party' },
    'none'
  ])
})

it('회차가 진행 중이면 판정하지 않고, 끝난 뒤에는 처음부터 2번을 센다', () => {
  const pending = watch([party(partyB)], withBaselines({ party: partyA }))
  const running = watch([party(partyB), party(partyB)], { ...pending.state, roundRunning: true })

  expect(running.signals).toEqual(NO_START)
  expect(
    watch([party(partyB), party(partyB)], { ...running.state, roundRunning: false }).signals
  ).toEqual(STARTS_PARTY)
})

it('회차에 넘긴 crop을 기준으로 기록하면 그 구성으로는 다시 시작하지 않는다', () => {
  const started = watch([party(partyB), party(partyB)], withBaselines({ party: partyA }))
  const recorded = recordScreenBaseline(started.state, 'party', partyB)

  expect(started.signals).toEqual(STARTS_PARTY)
  expect(watch([party(partyB), party(partyB)], recorded).signals).toEqual(NO_START)
  expect(watch([party(partyA), party(partyA)], recorded).signals).toEqual(STARTS_PARTY)
})

it('기준을 바꾸면 후보를 버려 새 기준 아래에서 다시 2번을 센다', () => {
  const pending = watch([party(partyB)], withBaselines({ party: partyA }))
  const recorded = recordScreenBaseline(pending.state, 'party', partyC)

  expect(watch([party(partyB), party(partyB)], recorded).signals).toEqual(STARTS_PARTY)
})

it('다른 화면의 기준을 기록하면 이 화면의 후보도 버린다', () => {
  const pending = watch([party(partyB)], withBaselines({ party: partyA }))
  const recorded = recordScreenBaseline(pending.state, 'raid', raidA)

  expect(watch([party(partyB), party(partyB)], recorded).signals).toEqual(STARTS_PARTY)
})

it('한 화면의 기준을 기록해도 다른 화면의 기준은 그대로 남는다', () => {
  const recorded = recordScreenBaseline(
    recordScreenBaseline(initialScreenWatchState, 'party', partyA),
    'raid',
    raidA
  )

  expect(watch([party(partyA), party(partyA)], recorded).signals).toEqual(NO_START)
  expect(watch([raid(raidA), raid(raidA)], recorded).signals).toEqual(NO_START)
})

it('회차 진행 중에 기준을 기록해도 진행 중이면 판정하지 않는다', () => {
  const running = { ...withBaselines({ party: partyA }), roundRunning: true }
  const recorded = recordScreenBaseline(running, 'party', partyC)

  expect(watch([party(partyB), party(partyB)], recorded).signals).toEqual(NO_START)
})
