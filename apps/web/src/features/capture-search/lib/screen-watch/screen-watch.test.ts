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

type Rgb = readonly [number, number, number]
type Glyph = 'full' | 'upper' | 'middle' | 'lower'

const NAME_WIDTH = 73
const NAME_HEIGHT = 17
const GLYPH_WIDTH = 6
const GLYPH_LEFT = 4
const GLYPH_ROWS: Readonly<Record<Glyph, readonly [number, number]>> = {
  full: [4, 12],
  upper: [4, 8],
  middle: [6, 10],
  lower: [8, 12]
}
// 두 글자 이름의 마지막 글자 칸 바로 뒤 6열이다. 이름에 붙은 글자 픽셀을 원하는 개수만큼 더할 때 쓴다.
const EXTRA_TEXT_LEFT = GLYPH_LEFT + 2 * (GLYPH_WIDTH + 1)

const DARK: Rgb = [24, 28, 36]
const LIGHT: Rgb = [235, 235, 235]
const YELLOW: Rgb = [200, 170, 30]
const PURPLE: Rgb = [120, 60, 160]
const SKY: Rgb = [90, 170, 220]

// 합성 이름 crop이다. 글자는 GLYPH_WIDTH 폭 칸에 1열 간격으로 그리며, upper와 lower는 48픽셀이 다르다.
function nameCrop(
  glyphs: readonly Glyph[],
  {
    background = DARK,
    text = LIGHT
  }: { background?: Rgb | ((pixel: number) => Rgb); text?: Rgb } = {}
): DNFParticipantFrame {
  const rgba = new Uint8Array(NAME_WIDTH * NAME_HEIGHT * 4)
  for (let pixel = 0; pixel < NAME_WIDTH * NAME_HEIGHT; pixel += 1) {
    rgba.set(
      [...(typeof background === 'function' ? background(pixel) : background), 255],
      pixel * 4
    )
  }
  const pixels = glyphs.flatMap((glyph, index) => {
    const [top, bottom] = GLYPH_ROWS[glyph]

    return block(GLYPH_LEFT + index * (GLYPH_WIDTH + 1), top, GLYPH_WIDTH, bottom - top)
  })

  return paint({ width: NAME_WIDTH, height: NAME_HEIGHT, rgba }, pixels, text)
}

function block(left: number, top: number, width: number, height: number): number[] {
  return Array.from(
    { length: width * height },
    (_, index) => (top + Math.floor(index / width)) * NAME_WIDTH + left + (index % width)
  )
}

function paint(
  crop: DNFParticipantFrame,
  pixels: readonly number[],
  color: Rgb
): DNFParticipantFrame {
  const rgba = Uint8Array.from(crop.rgba)
  for (const pixel of pixels) {
    rgba.set(color, pixel * 4)
  }

  return { ...crop, rgba }
}

function withExtraText(
  crop: DNFParticipantFrame,
  count: number,
  text = LIGHT
): DNFParticipantFrame {
  return paint(
    crop,
    block(EXTRA_TEXT_LEFT, GLYPH_ROWS.full[0], GLYPH_WIDTH, 8).slice(0, count),
    text
  )
}

function sized(width: number, height: number): DNFParticipantFrame {
  return { width, height, rgba: new Uint8Array(width * height * 4) }
}

const nameA = nameCrop(['full', 'upper'])
const nameB = nameCrop(['full', 'lower'])
const partyA: NameCrops = [nameA, nameB, null, null]
const partyB: NameCrops = [nameA, nameCrop(['full', 'upper', 'full']), null, null]
const partyC: NameCrops = [nameA, nameCrop(['full', 'lower', 'full']), null, null]
const raidA: NameCrops = [nameB, nameA, nameCrop(['upper'])]

function observe(
  kind: ScreenWatchKind,
  crops: NameCrops | null,
  town = true
): ScreenWatchObservation {
  return { town, kind, crops }
}

function party(crops: NameCrops | null, town = true): ScreenWatchObservation {
  return observe('party', crops, town)
}

function raid(crops: NameCrops | null): ScreenWatchObservation {
  return observe('raid', crops)
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

function twiceAgainst(
  kind: ScreenWatchKind,
  baseline: DNFParticipantFrame,
  first: DNFParticipantFrame,
  second = first
): ScreenWatchSignal[] {
  const state = withBaselines({ [kind]: [baseline] })

  return watch([observe(kind, [first]), observe(kind, [second])], state).signals
}

function starts(kind: ScreenWatchKind): ScreenWatchSignal[] {
  return ['none', { kind }]
}

const KINDS: readonly ScreenWatchKind[] = ['party', 'raid']

const NO_START = ['none', 'none']
const STARTS_PARTY = starts('party')

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

it.each(KINDS)(
  '%s 화면에서 배경 색만 노랑에서 보라, 하늘색으로 바뀌면 같은 구성으로 본다',
  (kind) => {
    const glyphs: Glyph[] = ['full', 'upper']
    const baseline = nameCrop(glyphs, { background: YELLOW })

    for (const background of [PURPLE, SKY]) {
      expect(twiceAgainst(kind, baseline, nameCrop(glyphs, { background }))).toEqual(NO_START)
    }
  }
)

it.each(KINDS)(
  '%s 화면에서 배경 색이 프레임마다 바뀌어도 새 구성이 2번 연속 보이면 시작한다',
  (kind) => {
    expect(
      twiceAgainst(
        kind,
        nameCrop(['full', 'upper'], { background: YELLOW }),
        nameCrop(['full', 'lower'], { background: PURPLE }),
        nameCrop(['full', 'lower'], { background: SKY })
      )
    ).toEqual(starts(kind))
  }
)

// 같은 폭의 한 음절이 바뀐 이름이다. upper와 middle은 24픽셀이 달라, 이름 전체가 다른 쌍의 최소 79보다 작다.
it.each(KINDS)(
  '%s 화면에서 같은 폭의 글자 하나가 획 일부만 달라져도 다른 구성으로 본다',
  (kind) => {
    expect(
      twiceAgainst(kind, nameCrop(['full', 'upper', 'full']), nameCrop(['full', 'middle', 'full']))
    ).toEqual(starts(kind))
  }
)

it.each(KINDS)(
  '%s 화면에서 글자 여부가 다른 픽셀이 9개면 같은 구성, 10개면 다른 구성으로 본다',
  (kind) => {
    const base = nameCrop(['full', 'full'])

    expect(twiceAgainst(kind, base, withExtraText(base, 9))).toEqual(NO_START)
    expect(twiceAgainst(kind, base, withExtraText(base, 10))).toEqual(starts(kind))
  }
)

// 반투명한 공대 이름 칸에 비치는 밝은 반점이다. BT.601 회색으로는 연노랑 글자처럼 글자로 남는다.
it('공대 이름 칸의 반점이 옮겨 가도 같은 구성으로 보고, 반점 속에서도 새 구성은 시작한다', () => {
  const sparkles = (offset: number) => (pixel: number) =>
    (pixel + offset) % 5 === 0 ? ([250, 230, 60] as const) : YELLOW
  const text: Rgb = [255, 240, 150]
  const name = (glyphs: readonly Glyph[], offset: number) =>
    nameCrop(glyphs, { background: sparkles(offset), text })

  expect(twiceAgainst('raid', name(['full', 'upper'], 0), name(['full', 'upper'], 2))).toEqual(
    NO_START
  )
  expect(
    twiceAgainst(
      'raid',
      name(['full', 'upper'], 0),
      name(['full', 'lower'], 2),
      name(['full', 'lower'], 4)
    )
  ).toEqual(starts('raid'))
})

it('공대 선택 행 테두리가 생기거나 사라져도 같은 구성으로 본다', () => {
  const base = nameCrop(['full', 'upper'], { background: YELLOW })
  const selected = paint(base, block(0, 0, NAME_WIDTH, 1), [180, 200, 255])

  expect(twiceAgainst('raid', base, selected)).toEqual(NO_START)
})

// 가장 어두운 채널은 글자와 배경이 같은 20이라 공대 이진화로는 글자가 남지 않는다.
it('파티 이름은 가장 어두운 채널이 배경과 같은 색 글자도 BT.601 회색으로 갈라 다른 구성을 찾는다', () => {
  const colors = { background: [20, 20, 20] as const, text: [220, 20, 20] as const }

  expect(
    twiceAgainst('party', nameCrop(['full', 'upper'], colors), nameCrop(['full', 'lower'], colors))
  ).toEqual(STARTS_PARTY)
})

it('자리 수나 빈 자리가 달라지면 같은 crop이 남아 있어도 다른 구성으로 본다', () => {
  const state = withBaselines({ party: [nameA, null] })
  const twice = (crops: NameCrops) => watch([party(crops), party(crops)], state).signals

  expect(twice([nameA, null])).toEqual(NO_START)
  expect(twice([nameA, null, null])).toEqual(STARTS_PARTY)
  expect(twice([nameA, nameA])).toEqual(STARTS_PARTY)
  expect(twice([null, null])).toEqual(STARTS_PARTY)
})

it('한 자리라도 crop 폭이나 높이가 다르면 글자가 없어도 다른 구성으로 본다', () => {
  expect(twiceAgainst('party', sized(8, 4), sized(9, 4))).toEqual(STARTS_PARTY)
  expect(twiceAgainst('party', sized(8, 4), sized(8, 5))).toEqual(STARTS_PARTY)

  const state = withBaselines({ party: [nameA, sized(8, 4)] })
  const resized = [nameA, sized(8, 5)]

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
  const nearB = [withExtraText(nameA, 9), ...partyB.slice(1)]

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
