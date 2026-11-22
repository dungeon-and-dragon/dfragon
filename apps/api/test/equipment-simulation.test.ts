import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test, { type TestContext } from 'node:test'
import type { CharacterBasicInput, CharacterScoreInput } from '@dfragon/database'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import type {
  ScoreCalculator,
  ScoreEngineInput,
  ScoreEngineResult
} from '@dfragon/server-core/domain/score/index.js'
import type {
  ScoreWorker,
  ScoreWorkerMessage,
  ScoreWorkerRequest
} from '@dfragon/server-core/infrastructure/score/index.js'
import {
  payloadsFromEngineInput,
  readEngineInput
} from '@dfragon/server-core/test/score-fixtures.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/runtime/api-app.js'

type FixtureName = 'dealer-blade' | 'buffer-muse'
type Item = Record<string, unknown>
type Reply = (request: ScoreWorkerRequest) => ScoreEngineResult | null

const INVALID_REQUEST = 'INVALID_SIMULATION_REQUEST'
const SYNTHETIC_LIBRARY_PATH = '/synthetic/libdnfscore.so'

// 합성 결과다. 실제 엔진을 열지 않고, fake worker가 요청마다 이 결과로 답한다.
const versions = {
  package: 'dnfscore-native 0.5.0',
  rules_rev: 'rev15',
  bundle_id: 'phase33-rev15a'
}
const cardVersions = {
  package: 'dnfscore-native 0.5.0',
  rulesRev: 'rev15',
  bundleId: 'phase33-rev15a'
}

function engineResult(calculator: ScoreCalculator, input: ScoreEngineInput): ScoreEngineResult {
  const result: ScoreEngineResult = {
    calculator,
    score: 1741,
    skipped: null,
    approximate_score: null,
    approximate_source: null,
    warning: null,
    versions,
    display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null, mainStat: '힘' }
  }

  if (input.simulation === undefined) {
    return result
  }

  return {
    ...result,
    simulation: {
      score: 1802,
      skipped: null,
      approximate_score: null,
      approximate_source: null,
      warning: null,
      display: { buff30: null, buff50: null }
    }
  }
}

function cardScore(calculator: ScoreCalculator, value: number) {
  return { calculator, value, skipped: null, approximate: null, versions: cardVersions }
}

/** 엔진 worker의 메시지만 흉내 내고, 받은 요청을 남긴다. 답이 null이면 엔진이 오류 코드로 거부한 경우다. */
function scoring(reply: Reply = ({ calculator, input }) => engineResult(calculator, input)) {
  const requests: ScoreWorkerRequest[] = []
  const spawnScoreWorker = (): ScoreWorker => {
    const events = new EventEmitter()
    const answer = (request: ScoreWorkerRequest): ScoreWorkerMessage => {
      const result = reply(request)
      const text = result === null ? null : JSON.stringify(result)

      return { kind: 'result', id: request.id, text }
    }

    return {
      postMessage: (request) => {
        requests.push(request)
        queueMicrotask(() => events.emit('message', answer(request)))
      },
      on: events.on.bind(events),
      terminate: async () => undefined
    }
  }

  return { requests, options: { scoreLibraryPath: SYNTHETIC_LIBRARY_PATH, spawnScoreWorker } }
}

function fixture(name: FixtureName, edit: (items: Item[]) => Item[] = (items) => items) {
  const original = readEngineInput(name)
  const payloads: CharacterPayloads = payloadsFromEngineInput(original)
  const equipment = payloads.equipment.equipment as Item[]
  payloads.equipment = { ...payloads.equipment, equipment: edit(structuredClone(equipment)) }
  const { characterId } = payloads.basic as Record<string, string>
  let fetches = 0
  const details: ApiHttpAppOptions['details'] = {
    fetchDetails: async () => {
      fetches++

      return payloads
    },
    catalog: new CatalogService(async (itemIds) => {
      const found = itemIds.flatMap((itemId) => {
        const data = original.items[itemId]
        if (data === undefined) {
          return []
        }

        return [[itemId, data] as const]
      })

      return new Map(found)
    })
  }

  return {
    original,
    payloads,
    details,
    path: `/characters/siroco/${characterId}`,
    fetches: () => fetches
  }
}

async function listen(t: TestContext, options: Partial<ApiHttpAppOptions>) {
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => assert.fail('상세 조회를 부르면 안 된다'),
      catalog: new CatalogService(async () => new Map())
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined,
    ...options
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return await app.getUrl()
}

async function simulate(origin: string, path: string, body: unknown, init: RequestInit = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  const response = await fetch(new URL(`${path}/simulation`, origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
    ...init
  })

  return { status: response.status, body: await response.json() }
}

function itemOf(items: readonly unknown[], slotId: string): Item {
  const item = (items as Item[]).find((candidate) => candidate.slotId === slotId)
  assert.notEqual(item, undefined, slotId)

  return item!
}

// 실제 등급표의 값이다. 표를 다시 생성해 값이 바뀌면 함께 고친다.
const DEALER_JACKET_ID = 'JACKET:10417944:dealer'
const DEALER_JACKET_ENCHANT = {
  status: [
    { name: '물리 공격력', value: 110 },
    { name: '마법 공격력', value: 110 },
    { name: '독립 공격력', value: 110 },
    { name: '힘', value: 90 },
    { name: '지능', value: 90 },
    { name: '최종 데미지 증가', value: '3%' }
  ]
}
const BUFFER_WAIST_ID = 'WAIST:10362002:buffer'
const BUFFER_WAIST_ENCHANT = {
  reinforceSkill: [
    { jobName: '프리스트(남)', skills: [{ name: '수호의 은총', value: '3' }] },
    { jobName: '프리스트(여)', skills: [{ name: '계시 : 아리아', value: '3' }] },
    { jobName: '마법사(여)', skills: [{ name: '퍼페티어', value: '3' }] },
    { jobName: '아처', skills: [{ name: '센세이션', value: '3' }] },
    { jobName: '거너(여)', skills: [{ name: 'apius::전장정보();', value: '3' }] }
  ],
  status: [
    { name: '힘', value: 120 },
    { name: '지능', value: 120 },
    { name: '체력', value: 120 },
    { name: '정신력', value: 120 },
    { name: '물리 크리티컬 히트', value: '7%' },
    { name: '마법 크리티컬 히트', value: '7%' }
  ]
}

test('딜러가 바꾼 부위는 강화 수치와 마법부여만 바꾸고 나머지 칸과 다른 부위는 원본 그대로 엔진에 넣는다', async (t) => {
  const { original, payloads, details, path } = fixture('dealer-blade')
  const before = structuredClone(payloads)
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })
  const response = await simulate(origin, path, {
    equipment: [{ slotId: 'JACKET', reinforce: 12, amplified: false, enchantId: DEALER_JACKET_ID }]
  })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    baseline: cardScore('equipment', 1741),
    simulated: cardScore('equipment', 1802)
  })
  assert.equal(engine.requests.length, 1)
  const { input, calculator } = engine.requests[0]!
  const { simulation, ...rest } = input
  assert.equal(calculator, 'equipment')
  assert.deepEqual(rest, original)
  assert.deepEqual(simulation, {
    equipment: [
      {
        ...itemOf(original.equipment.equipment as unknown[], 'JACKET'),
        reinforce: 12,
        amplificationName: null,
        enchant: DEALER_JACKET_ENCHANT
      }
    ]
  })
  assert.deepEqual(payloads, before)
})

test('증폭한 부위가 없는 캐릭터의 장비를 증폭으로 바꾸면 원본 계산의 주 스탯으로 증폭 이름을 정하고, 같은 캐릭터는 주 스탯을 다시 계산하지 않는다', async (t) => {
  const { original, details, path } = fixture('dealer-blade')
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })
  const body = {
    equipment: [{ slotId: 'WEAPON', reinforce: 10, amplified: true, enchantId: null }]
  }

  const first = await simulate(origin, path, body)
  const second = await simulate(origin, path, body)

  assert.deepEqual(first, {
    status: 200,
    body: { baseline: cardScore('equipment', 1741), simulated: cardScore('equipment', 1802) }
  })
  assert.deepEqual(second, first)
  assert.deepEqual(
    engine.requests.map(({ input }) => input.simulation !== undefined),
    [false, true, true]
  )
  assert.deepEqual(engine.requests[1]!.input.simulation, {
    equipment: [
      {
        ...itemOf(original.equipment.equipment as unknown[], 'WEAPON'),
        reinforce: 10,
        amplificationName: '차원의 힘'
      }
    ]
  })
})

function amplifiedAs(names: Readonly<Record<string, string | null>>) {
  return (items: Item[]) =>
    items.map((item) => {
      const name = names[item.slotId as string]

      if (name === undefined) {
        return item
      }

      return { ...item, amplificationName: name }
    })
}

// 원본 장비 응답 순서는 WEAPON, TITLE, JACKET, SHOULDER, PANTS 순이다.
for (const [name, fixtureName, amplified, changes, expected] of [
  [
    '모든 부위를 같은 이름으로 증폭한 캐릭터는 그 이름을 쓴다',
    'buffer-muse',
    {
      WEAPON: '차원의 체력',
      JACKET: '차원의 체력',
      SHOULDER: '차원의 체력',
      PANTS: null,
      WAIST: '차원의 체력',
      SHOES: '차원의 체력',
      AMULET: '차원의 체력',
      WRIST: '차원의 체력',
      RING: '차원의 체력',
      SUPPORT: '차원의 체력',
      MAGIC_STON: '차원의 체력',
      EARRING: '차원의 체력'
    },
    [{ slotId: 'PANTS', reinforce: 10, amplified: true, enchantId: null }],
    '차원의 체력'
  ],
  [
    '증폭 이름이 섞이면 원본에서 가장 많이 쓴 이름을 쓰고, 칭호와 요청에서 증폭을 푼 부위는 이름 선택을 바꾸지 않는다',
    'dealer-blade',
    { WEAPON: '차원의 지능', TITLE: '차원의 지능', JACKET: '차원의 힘', SHOULDER: '차원의 힘' },
    [
      { slotId: 'JACKET', reinforce: 0, amplified: false, enchantId: null },
      { slotId: 'PANTS', reinforce: 10, amplified: true, enchantId: null }
    ],
    '차원의 힘'
  ],
  [
    '가장 많이 쓴 이름이 동률이면 장비 응답에서 먼저 나온 이름을 쓴다',
    'dealer-blade',
    { JACKET: '차원의 지능', SHOULDER: '차원의 힘' },
    [{ slotId: 'PANTS', reinforce: 10, amplified: true, enchantId: null }],
    '차원의 지능'
  ]
] as const) {
  test(`강화한 장비를 증폭으로 바꿀 때 ${name}, 주 스탯 계산은 하지 않는다`, async (t) => {
    const { payloads, details, path } = fixture(fixtureName, amplifiedAs(amplified))
    const engine = scoring()
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, { equipment: changes })

    assert.equal(response.status, 200)
    assert.equal(engine.requests.length, 1)
    const items = payloads.equipment.equipment as unknown[]
    const pants = engine.requests[0]!.input.simulation!.equipment.find(
      (item) => item.slotId === 'PANTS'
    )
    assert.deepEqual(pants, {
      ...itemOf(items, 'PANTS'),
      reinforce: 10,
      amplificationName: expected
    })
  })
}

test('버퍼는 버프 점수로 계산하고, 증폭을 유지한 장비는 원본 증폭 이름을 두며 증폭을 끈 장비는 이름을 지운다', async (t) => {
  const { original, details, path } = fixture('buffer-muse')
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })
  const response = await simulate(origin, path, {
    equipment: [
      { slotId: 'WEAPON', reinforce: 13, amplified: true, enchantId: null },
      { slotId: 'WAIST', reinforce: 11, amplified: false, enchantId: BUFFER_WAIST_ID }
    ]
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.baseline.calculator, 'buff')
  assert.equal(response.body.simulated.calculator, 'buff')
  assert.deepEqual(
    engine.requests.map(({ calculator }) => calculator),
    ['buff']
  )
  const items = original.equipment.equipment as unknown[]
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [
      { ...itemOf(items, 'WEAPON'), reinforce: 13, amplificationName: '차원의 정신력' },
      {
        ...itemOf(items, 'WAIST'),
        reinforce: 11,
        amplificationName: null,
        enchant: BUFFER_WAIST_ENCHANT
      }
    ]
  })
})

test('바꾼 부위가 없으면 시뮬레이션 입력 없이 원본을 한 번 계산해 두 칸에 같은 점수를 준다', async (t) => {
  const { original, details, path } = fixture('dealer-blade')
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, { equipment: [] })

  assert.deepEqual(response, {
    status: 200,
    body: { baseline: cardScore('equipment', 1741), simulated: cardScore('equipment', 1741) }
  })
  assert.equal(engine.requests.length, 1)
  assert.deepEqual(engine.requests[0]!.input, original)
})

// 점수 기록이 오지 않으면 대기에서 멈추지 않고 실패하도록 timeout을 둔다.
test('시뮬레이션은 상세 조회와 같은 캐릭터 캐시를 쓰고, 상세 본문 캐시와 조회 기록을 남기지 않는다', {
  timeout: 10_000
}, async (t) => {
  const { payloads, details, path, fetches } = fixture('dealer-blade')
  // golden 입력의 기본 정보는 가명이라 모험단이 없어 저장하지 않으므로, 상세 조회가 기록하는 합성 값을 넣는다.
  Object.assign(payloads.basic, { serverId: 'siroco', adventureName: '합성모험단', fame: 61234 })
  const engine = scoring()
  const basics: CharacterBasicInput[] = []
  const scores: CharacterScoreInput[] = []
  const origin = await listen(t, {
    details,
    ...engine.options,
    recordCharacterBasic: async (input) => {
      basics.push(input)
    },
    recordCharacterScore: async (input) => {
      scores.push(input)
    }
  })

  const simulated = await simulate(origin, path, {
    equipment: [{ slotId: 'WEAPON', reinforce: 12, amplified: false, enchantId: null }]
  })
  const detail = await fetch(new URL(path, origin))
  await detail.arrayBuffer()
  while (scores.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }

  assert.equal(simulated.status, 200)
  assert.equal(detail.status, 200)
  assert.equal(fetches(), 1)
  // 시뮬레이션이 상세 본문을 저장했다면 상세 조회는 점수를 다시 계산하지 않는다.
  assert.deepEqual(
    engine.requests.map(({ input }) => input.simulation !== undefined),
    [true, false]
  )
  assert.equal(basics.length, 1)
  assert.deepEqual(
    scores.map(({ score }) => score),
    [1741]
  )
})

test('엔진이 없으면 두 점수 모두 null이다', async (t) => {
  const { details, path } = fixture('dealer-blade')
  const origin = await listen(t, { details })

  const response = await simulate(origin, path, {
    equipment: [{ slotId: 'WEAPON', reinforce: 10, amplified: true, enchantId: null }]
  })

  assert.deepEqual(response, { status: 200, body: { baseline: null, simulated: null } })
})

for (const [name, change, expectedRequests] of [
  [
    '시뮬레이션 입력을 거부하면',
    { slotId: 'WEAPON', reinforce: 12, amplified: false, enchantId: null },
    [true]
  ],
  [
    '주 스탯을 내지 않으면 시뮬레이션 입력을 보내지 않고',
    { slotId: 'WEAPON', reinforce: 10, amplified: true, enchantId: null },
    [false]
  ]
] as const) {
  test(`옛 엔진이 ${name} 두 점수 모두 null이다`, async (t) => {
    const { details, path } = fixture('dealer-blade')
    // 배포된 엔진은 모르는 simulation 키를 오류 코드로 거부하고 display.mainStat을 내지 않는다.
    const engine = scoring(({ calculator, input }) => {
      if (input.simulation !== undefined) {
        return null
      }

      const { mainStat: _mainStat, ...display } = engineResult(calculator, input).display

      return { ...engineResult(calculator, input), display }
    })
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, { equipment: [change] })

    assert.deepEqual(response, { status: 200, body: { baseline: null, simulated: null } })
    assert.deepEqual(
      engine.requests.map(({ input }) => input.simulation !== undefined),
      expectedRequests
    )
  })
}

test('엔진이 지원하지 않는 변경은 시뮬레이션 점수 없이 건너뛴 사유를 준다', async (t) => {
  const { details, path } = fixture('dealer-blade')
  const skipped = { kind: 'simulation', message: '지원하지 않는 변경' }
  const engine = scoring(({ calculator, input }) => {
    const result = engineResult(calculator, input)

    return { ...result, simulation: { ...result.simulation!, score: null, skipped } }
  })
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [{ slotId: 'WEAPON', reinforce: 12, amplified: false, enchantId: null }]
  })

  assert.deepEqual(response.body, {
    baseline: cardScore('equipment', 1741),
    simulated: {
      calculator: 'equipment',
      value: null,
      skipped,
      approximate: null,
      versions: cardVersions
    }
  })
})

const change = { slotId: 'JACKET', reinforce: 10, amplified: false, enchantId: null }
const invalidBodies: readonly (readonly [string, unknown])[] = [
  ['깨진 JSON', '{"equipment": ['],
  ['빈 본문', ''],
  ['equipment가 없는 본문', {}],
  ['배열이 아닌 equipment', { equipment: change }],
  ['시뮬레이터에 없는 부위', { equipment: [{ ...change, slotId: 'TITLE' }] }],
  ['모르는 부위', { equipment: [{ ...change, slotId: 'HAT' }] }],
  ['중복 부위', { equipment: [change, { ...change, reinforce: 11 }] }],
  ['음수 수치', { equipment: [{ ...change, reinforce: -1 }] }],
  ['소수 수치', { equipment: [{ ...change, reinforce: 10.5 }] }],
  ['문자열 수치', { equipment: [{ ...change, reinforce: '10' }] }],
  ['20을 넘는 수치', { equipment: [{ ...change, reinforce: 21 }] }],
  ['원본 수치를 넘는 수치', { equipment: [{ ...change, slotId: 'WEAPON', reinforce: 26 }] }],
  ['착용하지 않은 부위', { equipment: [{ ...change, slotId: 'SUPPORT' }] }],
  ['boolean이 아닌 증폭', { equipment: [{ ...change, amplified: 'true' }] }],
  ['빠진 칸', { equipment: [{ slotId: 'JACKET', reinforce: 10, amplified: false }] }],
  ['임의 마법부여 값', { equipment: [{ ...change, status: [{ name: '힘', value: 999 }] }] }],
  ['모르는 마법부여', { equipment: [{ ...change, enchantId: 'missing-enchant-grade' }] }],
  ['다른 부위의 마법부여', { equipment: [{ ...change, enchantId: 'SHOULDER:10361761:dealer' }] }],
  ['다른 역할의 마법부여', { equipment: [{ ...change, enchantId: 'JACKET:10417946:buffer' }] }],
  ['모르는 최상위 칸', { equipment: [], fame: 1 }]
]

for (const [name, body] of invalidBodies) {
  test(`요청 본문 사례(${name})는 엔진을 부르지 않고 ${INVALID_REQUEST}로 거절한다`, async (t) => {
    // 원본 수치가 20보다 높은 무기와 착용하지 않은 보조장비를 만든다.
    const { details, path } = fixture('dealer-blade', (items) =>
      items
        .filter((item) => item.slotId !== 'SUPPORT')
        .map((item) => (item.slotId === 'WEAPON' ? { ...item, reinforce: 25 } : item))
    )
    const engine = scoring()
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, body)

    assert.deepEqual(response, { status: 400, body: { error: { code: INVALID_REQUEST } } })
    assert.equal(engine.requests.length, 0)
  })
}

test('원본 수치가 20보다 높은 부위는 원본 수치까지 받는다', async (t) => {
  const { details, path } = fixture('dealer-blade', (items) =>
    items.map((item) => (item.slotId === 'WEAPON' ? { ...item, reinforce: 25 } : item))
  )
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [{ slotId: 'WEAPON', reinforce: 25, amplified: false, enchantId: null }]
  })

  assert.equal(response.status, 200)
})

for (const [name, init] of [
  ['Content-Length가 있는', {}],
  ['chunked로 보낸', { chunked: true }]
] as const) {
  test(`${name} 16KB를 넘는 본문은 읽지 않고 거절한다`, async (t) => {
    const { details, path } = fixture('dealer-blade')
    const engine = scoring()
    const origin = await listen(t, { details, ...engine.options })
    const text = `${JSON.stringify({ equipment: [] })}${' '.repeat(16 * 1024)}`
    const body =
      'chunked' in init
        ? { body: new Blob([text]).stream(), duplex: 'half' as const }
        : { body: text }

    const response = await simulate(origin, path, text, body)

    assert.deepEqual(response, { status: 400, body: { error: { code: INVALID_REQUEST } } })
    assert.equal(engine.requests.length, 0)
  })
}

test('캐릭터를 찾지 못하면 상세 조회와 같은 실패 응답이다', async (t) => {
  const origin = await listen(t, {
    details: {
      fetchDetails: async () => {
        throw new CharacterDetailFailure('notFound')
      },
      catalog: new CatalogService(async () => new Map())
    }
  })

  const response = await simulate(origin, '/characters/siroco/missing', { equipment: [] })

  assert.equal(response.status, 404)
  assert.equal(response.body.error.code, 'CHARACTER_NOT_FOUND')
})

// 닫기가 진행 중인 계산을 기다리지 못하고 멈추면 실패하도록 timeout을 둔다.
test('점수 계산을 기다리는 시뮬레이션이 있을 때 app을 닫으면 계산을 끊지 않고 끝난 뒤 닫힌다', {
  timeout: 10_000
}, async () => {
  const { details, path } = fixture('dealer-blade')
  const events = new EventEmitter()
  let pending: ScoreWorkerRequest | undefined
  let markCalculating!: () => void
  const calculating = new Promise<void>((resolve) => {
    markCalculating = resolve
  })
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details,
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined,
    scoreLibraryPath: SYNTHETIC_LIBRARY_PATH,
    spawnScoreWorker: () => ({
      postMessage: (request) => {
        pending = request
        markCalculating()
      },
      on: events.on.bind(events),
      terminate: async () => undefined
    })
  })
  await app.listen(0, '127.0.0.1')
  const response = simulate(await app.getUrl(), path, { equipment: [] })
  await calculating

  const closing = app.close()
  const { id, input, calculator } = pending!
  events.emit('message', {
    kind: 'result',
    id,
    text: JSON.stringify(engineResult(calculator, input))
  } satisfies ScoreWorkerMessage)
  await closing

  assert.deepEqual(await response, {
    status: 200,
    body: { baseline: cardScore('equipment', 1741), simulated: cardScore('equipment', 1741) }
  })
})
