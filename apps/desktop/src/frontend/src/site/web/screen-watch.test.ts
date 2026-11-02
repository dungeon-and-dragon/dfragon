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
function crop(gray: number, width = 4, height = 2): DNFParticipantFrame {
  const rgba = new Uint8Array(width * height * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba.set([gray, gray, gray, 255], index)
  }

  return { width, height, rgba }
}

const partyA: NameCrops = [crop(10), crop(20), null, null]
const partyB: NameCrops = [crop(10), crop(90), null, null]
const partyC: NameCrops = [crop(10), crop(150), null, null]
const raidA: NameCrops = [crop(30), crop(40), crop(50)]
const raidB: NameCrops = [crop(30), crop(40), crop(200)]

function inTown(screens: Partial<Omit<ScreenWatchObservation, 'town'>>): ScreenWatchObservation {
  return { town: true, raid: null, party: null, ...screens }
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

it('마을이 아니면 새 구성이 보여도 시작하지 않고, 그 틱은 연속 횟수를 끊는다', () => {
  const notTown = { town: false, raid: raidB, party: partyB }

  expect(watch([notTown, notTown]).signals).toEqual(['none', 'none'])
  expect(watch([inTown({ party: partyB }), notTown, inTown({ party: partyB })]).signals).toEqual([
    'none',
    'none',
    'none'
  ])
})

it('공대 창이 보이면 파티는 보지 않고 공대 구성으로만 시작한다', () => {
  const state = withBaselines({ party: partyA, raid: raidA })

  expect(
    watch([inTown({ raid: raidB, party: partyB }), inTown({ raid: raidB, party: partyB })], state)
      .signals
  ).toEqual(['none', { kind: 'raid' }])
  expect(
    watch([inTown({ raid: raidA, party: partyB }), inTown({ raid: raidA, party: partyB })], state)
      .signals
  ).toEqual(['none', 'none'])
})

it('공대 창을 닫아도 파티 구성이 마지막 파티 회차와 같으면 시작하지 않는다', () => {
  const state = withBaselines({ party: partyA, raid: raidB })

  expect(
    watch(
      [
        inTown({ raid: raidB, party: partyA }),
        inTown({ party: partyA }),
        inTown({ party: partyA })
      ],
      state
    ).signals
  ).toEqual(['none', 'none', 'none'])
})

it('파티 회차가 없었으면 마을에서 처음 보인 파티 구성도 2번 연속이면 시작한다', () => {
  expect(watch([inTown({ party: partyA }), inTown({ party: partyA })]).signals).toEqual([
    'none',
    { kind: 'party' }
  ])
})

it('기준과 같은 구성이 계속 보이면 시작하지 않는다', () => {
  const state = withBaselines({ party: partyA })

  expect(watch([inTown({ party: partyA }), inTown({ party: partyA })], state).signals).toEqual([
    'none',
    'none'
  ])
})

it('RGB 평균 차이가 6 이하면 같은 구성, 6을 넘으면 다른 구성으로 본다', () => {
  const state = withBaselines({ party: [crop(100)] })
  const twice = (crops: NameCrops) =>
    watch([inTown({ party: crops }), inTown({ party: crops })], state)

  expect(twice([crop(106)]).signals).toEqual(['none', 'none'])
  expect(twice([crop(94)]).signals).toEqual(['none', 'none'])
  expect(twice([crop(107)]).signals).toEqual(['none', { kind: 'party' }])
})

it('자리 수나 빈 자리가 달라지면 같은 crop이 남아 있어도 다른 구성으로 본다', () => {
  const state = withBaselines({ party: [crop(10), null] })
  const twice = (crops: NameCrops) =>
    watch([inTown({ party: crops }), inTown({ party: crops })], state)

  expect(twice([crop(10), null]).signals).toEqual(['none', 'none'])
  expect(twice([crop(10), null, null]).signals).toEqual(['none', { kind: 'party' }])
  expect(twice([crop(10), crop(10)]).signals).toEqual(['none', { kind: 'party' }])
  expect(twice([null, null]).signals).toEqual(['none', { kind: 'party' }])
})

it('한 자리라도 crop 크기가 다르면 색이 같아도 다른 구성으로 본다', () => {
  const state = withBaselines({ party: [crop(10), crop(20)] })
  const resized = [crop(10), crop(20, 5, 2)]

  expect(watch([inTown({ party: resized }), inTown({ party: resized })], state).signals).toEqual([
    'none',
    { kind: 'party' }
  ])
})

it('새 구성은 2번 연속 같아야 시작하고, 사이에 다른 프레임이 끼면 다시 센다', () => {
  const state = withBaselines({ party: partyA })

  expect(
    watch([inTown({ party: partyB }), inTown({ party: partyA }), inTown({ party: partyB })], state)
      .signals
  ).toEqual(['none', 'none', 'none'])
  expect(
    watch([inTown({ party: partyB }), inTown({ party: partyC }), inTown({ party: partyC })], state)
      .signals
  ).toEqual(['none', 'none', { kind: 'party' }])
})

it('시작 신호를 낸 뒤에는 다음 시작에도 2번 연속이 다시 필요하다', () => {
  const state = withBaselines({ party: partyA })
  const ticks = [partyB, partyB, partyB].map((party) => inTown({ party }))

  expect(watch(ticks, state).signals).toEqual(['none', { kind: 'party' }, 'none'])
})

it('회차가 진행 중이면 판정하지 않고, 끝난 뒤에는 처음부터 2번을 센다', () => {
  const pending = watch([inTown({ party: partyB })], withBaselines({ party: partyA }))
  const running = watch([inTown({ party: partyB }), inTown({ party: partyB })], {
    ...pending.state,
    roundRunning: true
  })

  expect(running.signals).toEqual(['none', 'none'])
  expect(
    watch([inTown({ party: partyB }), inTown({ party: partyB })], {
      ...running.state,
      roundRunning: false
    }).signals
  ).toEqual(['none', { kind: 'party' }])
})

it('회차에 넘긴 crop을 기준으로 기록하면 그 구성으로는 다시 시작하지 않는다', () => {
  const started = watch(
    [inTown({ party: partyB }), inTown({ party: partyB })],
    withBaselines({ party: partyA })
  )
  const recorded = recordScreenBaseline(started.state, 'party', partyB)

  expect(started.signals.at(-1)).toEqual({ kind: 'party' })
  expect(watch([inTown({ party: partyB }), inTown({ party: partyB })], recorded).signals).toEqual([
    'none',
    'none'
  ])
  expect(watch([inTown({ party: partyA }), inTown({ party: partyA })], recorded).signals).toEqual([
    'none',
    { kind: 'party' }
  ])
})

it('기준을 바꾸면 후보를 버려 새 기준 아래에서 다시 2번을 센다', () => {
  const pending = watch([inTown({ party: partyB })], withBaselines({ party: partyA }))
  const recorded = recordScreenBaseline(pending.state, 'party', partyC)

  expect(watch([inTown({ party: partyB }), inTown({ party: partyB })], recorded).signals).toEqual([
    'none',
    { kind: 'party' }
  ])
})
