import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import test, { type TestContext } from 'node:test'
import type { CharacterBasicInput, CharacterScoreInput } from '@dfragon/database'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import type {
  ScoreCalculator,
  ScoreEngineInput,
  ScoreEngineResult,
  ScoreSimulationInput
} from '@dfragon/server-core/domain/score/index.js'
import type {
  ScoreWorker,
  ScoreWorkerMessage,
  ScoreWorkerRequest
} from '@dfragon/server-core/infrastructure/score/index.js'
import { openNativeScore } from '@dfragon/server-core/infrastructure/score/index.js'
import {
  REAL_SCORE_LIBRARY_PATH,
  payloadsFromEngineInput,
  readEngineInput
} from '@dfragon/server-core/test/score-fixtures.js'
import {
  type SimulationFeatures,
  supportsSimulation
} from '../src/domain/equipment-simulation/index.js'
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

function fixture(
  name: FixtureName,
  edit: (items: Item[]) => Item[] = (items) => items,
  catalogItems: Readonly<Record<string, Item>> = {}
) {
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
        const data = original.items[itemId] ?? catalogItems[itemId]
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
// 묶이는 항목이 없는 준종결 항목이라 고른 항목이 그대로 엔진에 들어간다.
const DEALER_JACKET_ID = 'JACKET:10361759:dealer'
const DEALER_JACKET_ENCHANT = {
  status: [
    { name: '물리 공격력', value: 110 },
    { name: '마법 공격력', value: 110 },
    { name: '독립 공격력', value: 110 },
    { name: '힘', value: 90 },
    { name: '지능', value: 90 },
    { name: '최종 데미지 증가', value: '2%' }
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

test('힘 캐릭터가 지능 100 마법부여를 고르면 같은 묶음의 힘 100 항목을 엔진에 넣는다', async (t) => {
  const { payloads, details, path } = fixture('dealer-blade')
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [
      { slotId: 'WEAPON', reinforce: 0, amplified: false, enchantId: 'WEAPON:10316079:dealer' }
    ]
  })

  assert.equal(response.status, 200)
  assert.deepEqual(
    engine.requests.map(({ input }) => input.simulation !== undefined),
    [false, true]
  )
  assert.deepEqual(engine.requests[1]!.input.simulation, {
    equipment: [
      {
        ...itemOf(payloads.equipment.equipment as unknown[], 'WEAPON'),
        reinforce: 0,
        amplificationName: null,
        enchant: { status: [{ name: '힘', value: 100 }] }
      }
    ]
  })
})

test('4스탯 항목이 있는 묶음은 주스탯을 계산하지 않고 그 항목을 엔진에 넣는다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse', (items) =>
    items.map((item) => ({ ...item, amplificationName: null }))
  )
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [
      { slotId: 'WEAPON', reinforce: 11, amplified: false, enchantId: 'WEAPON:10326833:buffer' }
    ]
  })

  assert.equal(response.status, 200)
  assert.equal(engine.requests.length, 1)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [
      {
        ...itemOf(payloads.equipment.equipment as unknown[], 'WEAPON'),
        reinforce: 11,
        amplificationName: null,
        enchant: {
          status: [
            { name: '힘', value: 100 },
            { name: '지능', value: 100 },
            { name: '체력', value: 100 },
            { name: '정신력', value: 100 }
          ]
        }
      }
    ]
  })
})

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

// 엔진 버전이 오르면 점수가 바뀌므로 값은 고정하지 않고 원본과의 관계만 확인한다.
test('실제 엔진은 시뮬레이션 입력을 받아 원본 점수와 바꾼 점수를 낸다', {
  skip: REAL_SCORE_LIBRARY_PATH === null && '점수 엔진 라이브러리가 없음',
  timeout: 60_000
}, async (t) => {
  const dealer = fixture('dealer-blade')
  const buffer = fixture('buffer-muse')
  const realOrigin = (details: ApiHttpAppOptions['details']) =>
    listen(t, { details, scoreLibraryPath: REAL_SCORE_LIBRARY_PATH })

  const dealerOrigin = await realOrigin(dealer.details)
  const bufferOrigin = await realOrigin(buffer.details)
  const scoresOf = async (origin: string, path: string, equipment: unknown[]) => {
    const response = await simulate(origin, path, { equipment })

    assert.equal(response.status, 200)
    assert.equal(response.body.baseline.skipped, null)
    assert.equal(response.body.simulated.skipped, null)

    return response.body as {
      baseline: { calculator: string; value: number }
      simulated: { calculator: string; value: number }
    }
  }

  const allDealerSlots = (reinforce: number) =>
    (dealer.payloads.equipment.equipment as Item[])
      .filter(({ slotId }) => slotId !== 'TITLE')
      .map(({ slotId }) => ({ slotId, reinforce, amplified: false, enchantId: null }))

  const unchanged = await scoresOf(dealerOrigin, dealer.path, [])
  assert.equal(unchanged.simulated.value, unchanged.baseline.value)

  const raised = await scoresOf(dealerOrigin, dealer.path, allDealerSlots(12))
  assert.ok(raised.simulated.value > raised.baseline.value)

  const enchanted = await scoresOf(dealerOrigin, dealer.path, [
    { slotId: 'JACKET', reinforce: 0, amplified: false, enchantId: 'JACKET:10417944:dealer' }
  ])
  // 원본 상의 마법부여(공격력 50, 힘과 지능 20)보다 공격력 110, 4스탯 90, 최종 데미지 3% 항목이 높다.
  assert.ok(enchanted.simulated.value > enchanted.baseline.value)

  const amplified = await scoresOf(dealerOrigin, dealer.path, [
    { slotId: 'JACKET', reinforce: 12, amplified: true, enchantId: null }
  ])
  assert.ok(amplified.simulated.value > amplified.baseline.value)

  // 같은 묶음의 지능 100과 힘 100은 힘 캐릭터에게 같은 항목이 되어 점수도 같다.
  const intelligence = await scoresOf(dealerOrigin, dealer.path, [
    { slotId: 'WEAPON', reinforce: 0, amplified: false, enchantId: 'WEAPON:10316079:dealer' }
  ])
  const strength = await scoresOf(dealerOrigin, dealer.path, [
    { slotId: 'WEAPON', reinforce: 0, amplified: false, enchantId: 'WEAPON:10316077:dealer' }
  ])
  assert.equal(intelligence.simulated.value, strength.simulated.value)
  assert.notEqual(strength.simulated.value, strength.baseline.value)

  const buffRaised = await scoresOf(bufferOrigin, buffer.path, [
    { slotId: 'WEAPON', reinforce: 13, amplified: true, enchantId: null }
  ])
  assert.equal(buffRaised.baseline.calculator, 'buff')
  assert.ok(buffRaised.simulated.value > buffRaised.baseline.value)

  // 스킬 레벨 3은 원본 어깨와 같고 4스탯이 원본 120보다 낮은 110이라 점수가 내려간다.
  const skillEnchanted = await scoresOf(bufferOrigin, buffer.path, [
    { slotId: 'SHOULDER', reinforce: 11, amplified: true, enchantId: 'SHOULDER:10362000:buffer' }
  ])
  assert.ok(skillEnchanted.simulated.value < skillEnchanted.baseline.value)
})

// 칭호, 크리쳐, 오라 묶음의 대표 아이템 Neople 상세 가운데 엔진이 읽는 명성, 스탯, 버프 칸만 옮긴 값이다.
const slotItemDetails = JSON.parse(
  readFileSync(new URL('../../test/fixtures/slot-item-details.json', import.meta.url), 'utf8')
) as Record<string, Item>

const TITLE_ID = 'title:1123:character/common/title/100333206'
const TITLE_ITEM = {
  itemId: '42fd3d4144f788b37ed19c70281dcda6',
  itemName: '프로스트의 전설',
  itemRarity: '레어'
}
const CREATURE_ID = 'creature:991:creature/100990927'
const CREATURE_ITEM = {
  itemId: 'd1a086d0205f4928ec5f04b53b308521',
  itemName: '톱니꼬마 던니니',
  itemRarity: '레어'
}
const TOP_CREATURE_ID = 'creature:1261:creature/100991296'
const AURA_ID = 'aura:645:character/swordman/avatar/aura/101590961'
const AURA_ITEM = {
  itemId: '6997321d175648e99eb75adf5c8e2625',
  itemName: '초월한 폭풍의 기세',
  itemRarity: '레어'
}
const TOP_AURA_ID = 'aura:845:character/swordman/avatar/aura/101590700'

/** 그 버전 엔진이 낸 결과처럼 버전만 바꾼다. */
function versionedEngine(package_ = 'dnfscore-native 0.6.0'): Reply {
  return ({ calculator, input }) => {
    const result = engineResult(calculator, input)

    return { ...result, versions: { ...result.versions, package: package_ } }
  }
}

test('칭호, 크리쳐, 오라를 바꾸면 원본 항목의 아이템 칸만 바꿔 넣고 새 아이템 상세를 items에 더한다', async (t) => {
  const { original, payloads, details, path } = fixture('buffer-muse', undefined, slotItemDetails)
  const before = structuredClone(payloads)
  const engine = scoring(versionedEngine())
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [],
    title: TITLE_ID,
    creature: CREATURE_ID,
    aura: AURA_ID
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.baseline.value, 1741)
  assert.equal(response.body.simulated.value, 1802)
  assert.equal(engine.requests.length, 1)
  const { input } = engine.requests[0]!
  const avatar = original.avatar.avatar as unknown[]
  assert.deepEqual(input.simulation, {
    equipment: [
      {
        ...itemOf(original.equipment.equipment as unknown[], 'TITLE'),
        ...TITLE_ITEM,
        itemAvailableLevel: 1,
        enchant: {
          status: [
            { name: '모든 속성 강화', value: 4 },
            { name: '힘', value: 25 },
            { name: '지능', value: 25 },
            { name: '체력', value: 25 },
            { name: '정신력', value: 25 }
          ]
        }
      }
    ],
    creature: { ...(original.creature.creature as Item), ...CREATURE_ITEM },
    avatar: [
      {
        ...itemOf(avatar, 'AURORA'),
        ...AURA_ITEM,
        clone: { itemId: null, itemName: null },
        emblems: itemOf(avatar, 'AURORA').emblems
      }
    ]
  })
  for (const { itemId } of [TITLE_ITEM, CREATURE_ITEM, AURA_ITEM]) {
    assert.deepEqual(input.items[itemId], slotItemDetails[itemId], itemId)
  }
  const wornAuraId = itemOf(avatar, 'AURORA').itemId as string
  assert.deepEqual(input.items[wornAuraId], original.items[wornAuraId])
  assert.deepEqual(
    (input.simulation!.creature as Item).artifact,
    (original.creature.creature as Item).artifact
  )
  assert.deepEqual(payloads, before)
})

test('칭호 교체는 12부위 변경과 함께 보낼 수 있고 칭호는 장비 목록 뒤에 들어간다', async (t) => {
  const { original, details, path } = fixture('dealer-blade', undefined, slotItemDetails)
  const engine = scoring(versionedEngine())
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [{ slotId: 'WEAPON', reinforce: 12, amplified: false, enchantId: null }],
    title: TITLE_ID,
    creature: null
  })

  assert.equal(response.status, 200)
  const items = original.equipment.equipment as unknown[]
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [
      { ...itemOf(items, 'WEAPON'), reinforce: 12, amplificationName: null },
      { ...itemOf(items, 'TITLE'), ...TITLE_ITEM, itemAvailableLevel: 1 }
    ]
  })
})

test('새 아이템 상세를 받지 못하면 엔진을 부르지 않고 두 점수 모두 null이다', async (t) => {
  const { details, path } = fixture('buffer-muse')
  const engine = scoring(versionedEngine())
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, { equipment: [], creature: CREATURE_ID })

  assert.deepEqual(response, { status: 200, body: { baseline: null, simulated: null } })
  assert.equal(engine.requests.length, 0)
})

for (const [name, package_, body, expected] of [
  [
    '0.6.0 전 엔진에 칭호 교체를 보내면 두 점수 모두 null이다',
    'dnfscore-native 0.5.1',
    { equipment: [], title: TITLE_ID },
    { baseline: null, simulated: null }
  ],
  [
    '0.6.0 전 엔진도 12부위만 바꾼 요청은 점수를 낸다',
    'dnfscore-native 0.5.1',
    { equipment: [{ slotId: 'WEAPON', reinforce: 12, amplified: false, enchantId: null }] },
    { baseline: 1741, simulated: 1802 }
  ],
  [
    '0.10.0 엔진은 0.6.0 이후로 본다',
    'dnfscore-native 0.10.0',
    { equipment: [], title: TITLE_ID },
    { baseline: 1741, simulated: 1802 }
  ]
] as const) {
  test(`엔진 버전: ${name}`, async (t) => {
    const { details, path } = fixture('dealer-blade', undefined, slotItemDetails)
    const engine = scoring(versionedEngine(package_))
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, body)

    assert.equal(response.status, 200)
    assert.deepEqual(
      {
        baseline: response.body.baseline?.value ?? null,
        simulated: response.body.simulated?.value ?? null
      },
      expected
    )
  })
}

for (const [name, body, edit] of [
  [
    '모르는 칭호 id',
    { equipment: [], title: 'title:1:missing' },
    (payloads: CharacterPayloads) => payloads
  ],
  [
    '오라 목록의 id를 칭호로 보냄',
    { equipment: [], title: TOP_AURA_ID },
    (payloads: CharacterPayloads) => payloads
  ],
  [
    '문자열이 아닌 크리쳐 id',
    { equipment: [], creature: 1261 },
    (payloads: CharacterPayloads) => payloads
  ],
  [
    '칭호를 착용하지 않은 캐릭터의 칭호 교체',
    { equipment: [], title: TITLE_ID },
    (payloads: CharacterPayloads) => {
      payloads.equipment.equipment = (payloads.equipment.equipment as Item[]).filter(
        ({ slotId }) => slotId !== 'TITLE'
      )

      return payloads
    }
  ],
  [
    '크리쳐가 없는 캐릭터의 크리쳐 교체',
    { equipment: [], creature: CREATURE_ID },
    (payloads: CharacterPayloads) => {
      payloads.creature.creature = null

      return payloads
    }
  ],
  [
    '오라를 착용하지 않은 캐릭터의 오라 교체',
    { equipment: [], aura: AURA_ID },
    (payloads: CharacterPayloads) => {
      payloads.avatar.avatar = (payloads.avatar.avatar as Item[]).filter(
        ({ slotId }) => slotId !== 'AURORA'
      )

      return payloads
    }
  ]
] as const) {
  test(`요청 본문 사례(${name})는 엔진을 부르지 않고 ${INVALID_REQUEST}로 거절한다`, async (t) => {
    const { payloads, details, path } = fixture('dealer-blade', undefined, slotItemDetails)
    edit(payloads)
    const engine = scoring(versionedEngine())
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, body)

    assert.deepEqual(response, { status: 400, body: { error: { code: INVALID_REQUEST } } })
    assert.equal(engine.requests.length, 0)
  })
}

function realEnginePackage(): string | null {
  if (REAL_SCORE_LIBRARY_PATH === null) {
    return null
  }

  const score = openNativeScore({ path: REAL_SCORE_LIBRARY_PATH })
  const text = score?.(readEngineInput('dealer-blade'), 'equipment') ?? null

  if (text === null) {
    return null
  }

  return (JSON.parse(text) as ScoreEngineResult).versions.package
}

const REAL_ENGINE_PACKAGE = realEnginePackage()

function realEngineSupports(features: Partial<SimulationFeatures>): boolean {
  if (REAL_ENGINE_PACKAGE === null) {
    return false
  }

  return supportsSimulation(REAL_ENGINE_PACKAGE, {
    slotItems: false,
    equipmentItems: false,
    oathTunes: false,
    equipmentSet: false,
    weaponTune: false,
    oathItems: false,
    ...features
  })
}

const REAL_SLOT_ITEM_ENGINE = realEngineSupports({ slotItems: true })

// 엔진 버전이 오르면 점수가 바뀌므로 값은 고정하지 않고 원본과의 관계만 확인한다.
test('실제 엔진은 딜러의 칭호, 크리쳐, 오라를 더 높은 명성 묶음으로 바꾸면 점수를 올린다', {
  skip: !REAL_SLOT_ITEM_ENGINE && '칭호, 크리쳐, 오라 교체를 반영하는 0.6.0 이상 엔진이 없음',
  timeout: 60_000
}, async (t) => {
  // 원본은 칭호 숙명을 지닌 자[루크](명성 601), 크리쳐 에지(731), 오라 풍요의 파도(325)다.
  const { details, path } = fixture('dealer-blade', undefined, slotItemDetails)
  const origin = await listen(t, { details, scoreLibraryPath: REAL_SCORE_LIBRARY_PATH })

  for (const body of [
    { equipment: [], title: TITLE_ID },
    { equipment: [], creature: TOP_CREATURE_ID },
    { equipment: [], aura: TOP_AURA_ID }
  ]) {
    const response = await simulate(origin, path, body)

    assert.equal(response.status, 200)
    assert.equal(response.body.simulated.skipped, null, JSON.stringify(body))
    assert.ok(response.body.simulated.value > response.body.baseline.value, JSON.stringify(body))
  }
})

// 교체 아이템의 Neople 상세 가운데 엔진과 API가 읽는 칸만 운영 공개 API 응답에서 옮긴 값이다.
// 공개 API에 없는 종류 id는 부위마다 같은 Neople 값을 착용 장비 응답에서, 세트 칸은 선택 목록의 세트에서 채웠다.
const equipmentItemDetails = JSON.parse(
  readFileSync(new URL('../../test/fixtures/equipment-item-details.json', import.meta.url), 'utf8')
) as Record<string, Item>

const ITEM_ENGINE = 'dnfscore-native 0.7.0'
const OATH_ENGINE = 'dnfscore-native 0.8.0'
const PURIFICATION_SET = {
  setItemId: '11f7d203a05ea6f13300c0facb39f11e',
  setItemName: '칠흑의 정화 세트'
}
const GOLDEN_SET = {
  setItemId: '7f788a703a87d783079b41d0fe6448c9',
  setItemName: '영원히 이어지는 황금향 세트'
}
const NO_SET = { setItemId: null, setItemName: null }
const PURIFICATION_EPIC_JACKET = 'd51d0071c181d4fe99b04e19f2fd6a82'
const PURIFICATION_EPIC_RING = '854d52a64fe061dc2586a10bf274676b'
const SHADOW_EPIC_JACKET = '712eef49bfaeef17d21b4d984b6c28b0'
const EXALTED_RING = 'aa5273499f19ddba846919dbb6857d82'
const GOLDEN_EPIC_SUPPORT = '5c6d51da9fb172943219d333a06c9868'
const GOLDEN_EPIC_JACKET = 'a1b024bc3c80c0028e8408a5e008f915'
const PURIFICATION_CONSECRATED = {
  JACKET: 'fc6be2db9857338ad5a17a0d202bd34f',
  SHOULDER: '1411123f8393e57af10a7aeef33c483c',
  PANTS: '71085a9389839043a87b6ef6c29e8875',
  SHOES: 'f9ec0ece26ea9cda37e1d16618d240d5',
  WAIST: 'd687b2d94eefb217a39d09784670509d'
}

/** 바꾸지 않는 강화, 증폭, 마법부여는 원본 그대로 보내고 새 칸만 더한다. */
function itemChange(items: readonly unknown[], slotId: string, fields: Item): Item {
  const worn = itemOf(items, slotId)

  return {
    slotId,
    reinforce: worn.reinforce,
    amplified: worn.amplificationName !== null,
    enchantId: null,
    ...fields
  }
}

function detailFields(itemId: string): Item {
  const detail = equipmentItemDetails[itemId]!
  const { itemName, itemRarity, itemTypeId, itemType, itemTypeDetailId, itemTypeDetail } = detail
  const { setItemId, setItemName } = detail

  return {
    itemId,
    itemName,
    itemRarity,
    itemTypeId,
    itemType,
    itemTypeDetailId,
    itemTypeDetail,
    setItemId,
    setItemName
  }
}

function withoutKeys(item: Item, keys: readonly string[]): Item {
  return Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)))
}

function bySlot(entries: readonly unknown[]): Record<string, Item> {
  return Object.fromEntries((entries as Item[]).map((entry) => [entry.slotId as string, entry]))
}

test('새 칸을 null로 보내고 서약을 빈 배열로 보낸 요청은 새 칸이 없는 요청과 같은 엔진 입력을 만든다', async (t) => {
  const { details, path } = fixture('dealer-blade')
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })
  const change = { slotId: 'JACKET', reinforce: 12, amplified: false, enchantId: DEALER_JACKET_ID }

  const plain = await simulate(origin, path, { equipment: [change] })
  const nulls = await simulate(origin, path, {
    equipment: [{ ...change, variantId: null, tune: null, potency: null }],
    oath: []
  })

  assert.deepEqual(nulls, plain)
  assert.equal(plain.body.simulated.value, 1802)
  assert.deepEqual(engine.requests[1]!.input, engine.requests[0]!.input)
})

test('딜러 상의를 같은 세트의 에픽으로 바꾸면 아이템 칸을 새 상세로 바꾸고 강화, 증폭, 품질과 조율 단계는 유지한다', async (t) => {
  const { original, payloads, details, path } = fixture(
    'dealer-blade',
    undefined,
    equipmentItemDetails
  )
  const before = structuredClone(payloads)
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'JACKET', { variantId: PURIFICATION_EPIC_JACKET })]
  })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    baseline: {
      ...cardScore('equipment', 1741),
      versions: { ...cardVersions, package: ITEM_ENGINE }
    },
    simulated: {
      ...cardScore('equipment', 1802),
      versions: { ...cardVersions, package: ITEM_ENGINE }
    }
  })
  assert.equal(engine.requests.length, 1)
  const { input } = engine.requests[0]!
  // 원본 상의는 레전더리 조율 2단계(185)이고 에픽 2단계는 235다.
  assert.deepEqual(input.simulation, {
    equipment: [
      {
        ...itemOf(items, 'JACKET'),
        ...detailFields(PURIFICATION_EPIC_JACKET),
        ...PURIFICATION_SET,
        itemName: '칠흑의 정화 상의',
        itemRarity: '에픽',
        itemGradeName: '상급',
        reinforce: 0,
        amplificationName: null,
        tune: [{ level: 2, setPoint: 235 }]
      }
    ]
  })
  assert.deepEqual(input.items, {
    ...original.items,
    [PURIFICATION_EPIC_JACKET]: equipmentItemDetails[PURIFICATION_EPIC_JACKET]
  })
  assert.deepEqual(payloads, before)
})

test('선택 목록에 없는 세트의 장비를 낀 부위는 목록에 있는 세트 가운데 포인트가 가장 큰 주 세트의 선택지로 바꾼다', async (t) => {
  const unlistedSet = {
    setItemId: 'ffffffffffffffffffffffffffffffff',
    setItemName: '목록에 없는 세트'
  }
  const { payloads, details, path } = fixture(
    'dealer-blade',
    (entries) =>
      entries.map((entry) => (entry.slotId === 'JACKET' ? { ...entry, ...unlistedSet } : entry)),
    equipmentItemDetails
  )
  // 포인트가 더 큰 세트가 목록에 없으면 주 세트 후보에서 빠진다.
  const setItemInfo = payloads.equipment.setItemInfo as Item[]
  payloads.equipment.setItemInfo = [
    { ...unlistedSet, active: { setPoint: { current: 2620 } } },
    ...setItemInfo
  ]
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'JACKET', { variantId: PURIFICATION_EPIC_JACKET })]
  })

  assert.equal(response.status, 200)
  const { input } = engine.requests[0]!
  assert.deepEqual(input.simulation, {
    equipment: [
      {
        ...itemOf(items, 'JACKET'),
        ...detailFields(PURIFICATION_EPIC_JACKET),
        ...PURIFICATION_SET,
        itemName: '칠흑의 정화 상의',
        reinforce: 0,
        amplificationName: null,
        tune: [{ level: 2, setPoint: 235 }]
      }
    ]
  })
  assert.deepEqual(
    input.items[PURIFICATION_EPIC_JACKET],
    equipmentItemDetails[PURIFICATION_EPIC_JACKET]
  )
})

test('세트 밖 유일 장비를 낀 부위는 주 세트의 선택지로 바꾸고, 5축성이면 공용 이름 아이템으로 넣으며 유일 장비 칸을 지운다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse', undefined, equipmentItemDetails)
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]
  const consecratedSupport = 'd8d7fc1c77c8b955e0f137ec1e1c52c2'

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'SUPPORT', { variantId: GOLDEN_EPIC_SUPPORT })]
  })

  assert.equal(response.status, 200)
  const { input } = engine.requests[0]!
  assert.deepEqual(input.simulation, {
    equipment: [
      {
        ...withoutKeys(itemOf(items, 'SUPPORT'), ['exaltedInfo', 'potency']),
        ...detailFields(consecratedSupport),
        ...GOLDEN_SET,
        itemName: '초연한 청렴의 보조장비',
        reinforce: 11,
        amplificationName: '차원의 정신력',
        tune: [{ level: 0, setPoint: 215 }]
      }
    ]
  })
  assert.deepEqual(input.items[consecratedSupport], equipmentItemDetails[consecratedSupport])
})

for (const [name, potency, expected] of [
  ['정밀도를 보내지 않으면 100으로 넣는다', null, 100],
  ['보낸 정밀도를 넣는다', 37, 37]
] as const) {
  test(`반지를 유일 장비로 바꾸면 세트 칸을 비우고 조율을 유일 장비의 0단계로 자르며 ${name}`, async (t) => {
    const { payloads, details, path } = fixture(
      'dealer-blade',
      (entries) =>
        entries.map((entry) =>
          entry.slotId === 'RING' ? { ...entry, tune: [{ level: 2, setPoint: 235 }] } : entry
        ),
      equipmentItemDetails
    )
    const engine = scoring(versionedEngine(ITEM_ENGINE))
    const origin = await listen(t, { details, ...engine.options })
    const items = payloads.equipment.equipment as unknown[]

    const response = await simulate(origin, path, {
      equipment: [itemChange(items, 'RING', { variantId: EXALTED_RING, potency })]
    })

    assert.equal(response.status, 200)
    assert.deepEqual(engine.requests[0]!.input.simulation, {
      equipment: [
        {
          ...itemOf(items, 'RING'),
          ...detailFields(EXALTED_RING),
          ...NO_SET,
          itemName: '광휘를 머금은 눈동자',
          itemRarity: '태초',
          reinforce: 0,
          amplificationName: null,
          tune: [{ level: 0, setPoint: 265 }],
          potency: { value: expected }
        }
      ]
    })
  })
}

test('조율만 바꾸면 아이템과 items는 그대로 두고 그 단계의 세트 포인트를 넣는다', async (t) => {
  const { original, payloads, details, path } = fixture('dealer-blade')
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'SHOES', { tune: 3 })]
  })

  assert.equal(response.status, 200)
  const { input } = engine.requests[0]!
  assert.deepEqual(input.simulation, {
    equipment: [
      {
        ...itemOf(items, 'SHOES'),
        amplificationName: null,
        tune: [{ level: 3, setPoint: 145 }]
      }
    ]
  })
  assert.deepEqual(input.items, original.items)
})

test('유일 장비를 유지하며 정밀도만 바꾸면 정밀도 수치만 넣고 유일 장비 칸은 그대로 둔다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse')
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'SUPPORT', { potency: 50 })]
  })

  assert.equal(response.status, 200)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [{ ...itemOf(items, 'SUPPORT'), potency: { value: 50 } }]
  })
})

test('방어구 5부위를 모두 축성으로 바꾸면 방어구와 건드리지 않은 태초 목걸이, 에픽 마법석을 공용 이름 아이템으로 바꾼다', async (t) => {
  const { original, payloads, details, path } = fixture(
    'dealer-blade',
    undefined,
    equipmentItemDetails
  )
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: Object.entries(PURIFICATION_CONSECRATED).map(([slotId, variantId]) =>
      itemChange(items, slotId, { variantId })
    )
  })

  assert.equal(response.status, 200)
  const { input } = engine.requests[0]!
  const replaced = bySlot(input.simulation!.equipment)
  const expected = {
    JACKET: ['43803200c544fd434d9ab5c9880bebd3', '긍휼 속 자비의 상의', 255],
    SHOULDER: ['1fd5aa7227fb90d934620fd2b9bfbef6', '숭고한 심판의 어깨', 235],
    PANTS: ['0bf45c3b01cddaf53ee81a5271b20ae4', '명예로운 공경의 하의', 235],
    SHOES: ['a771af545571ab8a78f45c463bab947a', '고요한 안식의 신발', 245],
    WAIST: ['951150903ca24cb8598e758ba4875995', '완전한 침묵의 벨트', 235],
    AMULET: ['223dc58926c3f1b1d70b3577965010fb', '성스러운 믿음의 목걸이', 265],
    MAGIC_STON: ['96f87549f21b13bbb93d703e7244d621', '무결한 순수의 마법석', 215]
  } as const
  assert.deepEqual(Object.keys(replaced).sort(), Object.keys(expected).sort())
  for (const [slotId, [itemId, itemName, setPoint]] of Object.entries(expected)) {
    const consecrate = slotId in PURIFICATION_CONSECRATED ? { consecrate: true } : {}
    const { tune: _tune, ...worn } = itemOf(items, slotId)

    assert.deepEqual(
      replaced[slotId],
      {
        ...worn,
        ...detailFields(itemId),
        ...PURIFICATION_SET,
        ...consecrate,
        itemName,
        amplificationName: null,
        tune: [{ level: (itemOf(items, slotId).tune as Item[])[0]!.level, setPoint }]
      },
      slotId
    )
    assert.deepEqual(input.items[itemId], equipmentItemDetails[itemId], slotId)
  }
  assert.equal(Object.keys(input.items).length, Object.keys(original.items).length + 7)
})

test('5축성 캐릭터가 상의를 축성이 아닌 에픽으로 바꾸면 나머지 방어구를 축성 아이템으로, 에픽 마법석과 귀걸이를 세트 이름 아이템으로 되돌리고 흑아와 유일 장비는 그대로 둔다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse', undefined, equipmentItemDetails)
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'JACKET', { variantId: GOLDEN_EPIC_JACKET })]
  })

  assert.equal(response.status, 200)
  const replaced = bySlot(engine.requests[0]!.input.simulation!.equipment)
  const expected = {
    JACKET: ['a1b024bc3c80c0028e8408a5e008f915', '찬란한 황금향의 플레이트 아머', 215],
    SHOULDER: ['90e09e1ad869e07977b94fbf9cd6acce', '축성 : 찬란한 황금향의 플레이트 숄더', 235],
    PANTS: ['700fb5abf341de4f8f210213ccc5e7df', '축성 : 찬란한 황금향의 플레이트 레깅스', 235],
    SHOES: ['92d13dc1c38895202ee62b05e2b5d11e', '축성 : 찬란한 황금향의 플레이트 부츠', 235],
    WAIST: ['9c026e5d38dec89186fe2ac1f9a7da5c', '축성 : 찬란한 황금향의 플레이트 코일', 235],
    MAGIC_STON: ['30457efb8b2d19c2ca0b3b071b557af1', '찬란한 황금향의 저주 - 마법석', 215],
    EARRING: ['6dec30d4dbf75153cfad5af20cda006d', '찬란한 황금향의 이면 - 귀걸이', 215]
  } as const
  assert.deepEqual(Object.keys(replaced).sort(), Object.keys(expected).sort())
  for (const [slotId, [itemId, itemName, setPoint]] of Object.entries(expected)) {
    const consecrate = itemName.startsWith('축성 : ') ? { consecrate: true } : {}
    const worn = withoutKeys(itemOf(items, slotId), ['consecrate'])

    assert.deepEqual(
      replaced[slotId],
      {
        ...worn,
        ...detailFields(itemId),
        ...GOLDEN_SET,
        ...consecrate,
        itemName,
        amplificationName: '차원의 정신력',
        tune: [{ level: 0, setPoint }]
      },
      slotId
    )
  }
})

test('서약 결정의 조율을 바꾸면 바꾼 결정만 조율 단계와 그 단계의 세트 포인트를 바꿔 넣는다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse')
  const engine = scoring(versionedEngine(OATH_ENGINE))
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipment: [],
    oath: [
      { slotNo: 3, tune: 1 },
      { slotNo: 9, tune: 0 }
    ]
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.simulated.value, 1802)
  const crystals = (payloads.oath.oath as Item).crystal as Item[]
  // 에픽 결정은 0~3단계(165, 175, 185, 195), 태초 결정은 0단계(205)뿐이다.
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [],
    oath: {
      crystal: [
        { ...crystals[3], tune: { level: 1, setPoint: 175 } },
        { ...crystals[9], tune: { level: 0, setPoint: 205 } }
      ]
    }
  })
})

test('새 장비 아이템의 상세를 받지 못하면 엔진을 부르지 않고 두 점수 모두 null이다', async (t) => {
  const { payloads, details, path } = fixture('dealer-blade')
  const engine = scoring(versionedEngine(ITEM_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'JACKET', { variantId: PURIFICATION_EPIC_JACKET })]
  })

  assert.deepEqual(response, { status: 200, body: { baseline: null, simulated: null } })
  assert.equal(engine.requests.length, 0)
})

for (const [name, package_, body, expected] of [
  [
    '0.7.0 전 엔진에 아이템 교체를 보내면 두 점수 모두 null이다',
    'dnfscore-native 0.6.0',
    { equipment: [{ slotId: 'JACKET', variantId: PURIFICATION_EPIC_JACKET }] },
    null
  ],
  [
    '0.7.0 전 엔진에 조율 변경을 보내면 두 점수 모두 null이다',
    'dnfscore-native 0.6.0',
    { equipment: [{ slotId: 'SHOES', tune: 3 }] },
    null
  ],
  [
    '0.7.0 엔진은 아이템 교체를 반영한다',
    ITEM_ENGINE,
    { equipment: [{ slotId: 'JACKET', variantId: PURIFICATION_EPIC_JACKET }] },
    1802
  ],
  [
    '0.8.0 전 엔진에 서약 결정 조율을 보내면 두 점수 모두 null이다',
    ITEM_ENGINE,
    { equipment: [], oath: [{ slotNo: 0, tune: 1 }] },
    null
  ],
  [
    '0.8.0 엔진은 서약 결정 조율을 반영한다',
    OATH_ENGINE,
    { equipment: [], oath: [{ slotNo: 0, tune: 1 }] },
    1802
  ],
  [
    '0.7.0 전 엔진도 강화만 바꾼 요청은 점수를 낸다',
    'dnfscore-native 0.6.0',
    { equipment: [{ slotId: 'JACKET', reinforce: 12 }] },
    1802
  ]
] as const) {
  test(`엔진 버전: ${name}`, async (t) => {
    const { payloads, details, path } = fixture('dealer-blade', undefined, equipmentItemDetails)
    const engine = scoring(versionedEngine(package_))
    const origin = await listen(t, { details, ...engine.options })
    const items = payloads.equipment.equipment as unknown[]
    const equipment = body.equipment.map(({ slotId, ...fields }) =>
      itemChange(items, slotId, fields)
    )

    const response = await simulate(origin, path, { ...body, equipment })

    assert.equal(response.status, 200)
    assert.equal(response.body.simulated?.value ?? null, expected)
    assert.equal(engine.requests.length, 1)
  })
}

type PayloadEdit = (payloads: CharacterPayloads) => void

const keepPayloads: PayloadEdit = () => undefined

function editedItem(slotId: string, fields: Item): PayloadEdit {
  return (payloads) => {
    payloads.equipment.equipment = (payloads.equipment.equipment as Item[]).map((item) =>
      item.slotId === slotId ? { ...item, ...fields } : item
    )
  }
}

const invalidItemCases: readonly (readonly [string, FixtureName, Item, PayloadEdit])[] = [
  [
    '무기의 아이템 교체',
    'dealer-blade',
    { slotId: 'WEAPON', variantId: PURIFICATION_EPIC_JACKET },
    keepPayloads
  ],
  ['무기의 정밀도', 'dealer-blade', { slotId: 'WEAPON', potency: 50 }, keepPayloads],
  [
    '모르는 선택지 id',
    'dealer-blade',
    { slotId: 'JACKET', variantId: 'missing-variant' },
    keepPayloads
  ],
  [
    '다른 세트의 선택지 id',
    'dealer-blade',
    { slotId: 'JACKET', variantId: SHADOW_EPIC_JACKET },
    keepPayloads
  ],
  [
    '다른 부위의 선택지 id',
    'dealer-blade',
    { slotId: 'JACKET', variantId: PURIFICATION_EPIC_RING },
    keepPayloads
  ],
  [
    '착용하지 않은 부위의 아이템 교체',
    'dealer-blade',
    { slotId: 'JACKET', variantId: PURIFICATION_EPIC_JACKET },
    (payloads) => {
      payloads.equipment.equipment = (payloads.equipment.equipment as Item[]).filter(
        ({ slotId }) => slotId !== 'JACKET'
      )
    }
  ],
  [
    '주 세트가 없는 캐릭터의 세트 밖 부위 교체',
    'buffer-muse',
    { slotId: 'SUPPORT', variantId: GOLDEN_EPIC_SUPPORT },
    (payloads) => {
      payloads.equipment.setItemInfo = []
    }
  ],
  ['조율 단계 밖의 조율', 'dealer-blade', { slotId: 'JACKET', tune: 4 }, keepPayloads],
  ['조율할 수 없는 태초 장비의 조율', 'dealer-blade', { slotId: 'AMULET', tune: 1 }, keepPayloads],
  [
    '바꾼 유일 장비의 단계 밖 조율',
    'dealer-blade',
    { slotId: 'RING', variantId: EXALTED_RING, tune: 1 },
    keepPayloads
  ],
  [
    '선택 목록에 없는 착용 아이템의 조율',
    'dealer-blade',
    { slotId: 'SHOES', tune: 2 },
    editedItem('SHOES', {
      itemId: '00000000000000000000000000000000',
      itemName: '목록에 없는 신발'
    })
  ],
  [
    '유일 장비가 아닌 착용 아이템의 정밀도',
    'dealer-blade',
    { slotId: 'RING', potency: 50 },
    keepPayloads
  ],
  [
    '유일 장비가 아닌 아이템으로 바꾸며 보낸 정밀도',
    'buffer-muse',
    { slotId: 'SUPPORT', variantId: GOLDEN_EPIC_SUPPORT, potency: 50 },
    keepPayloads
  ],
  ['100을 넘는 정밀도', 'buffer-muse', { slotId: 'SUPPORT', potency: 101 }, keepPayloads],
  ['음수 조율', 'dealer-blade', { slotId: 'JACKET', tune: -1 }, keepPayloads],
  ['소수 조율', 'dealer-blade', { slotId: 'JACKET', tune: 1.5 }, keepPayloads],
  ['문자열이 아닌 선택지 id', 'dealer-blade', { slotId: 'JACKET', variantId: 1 }, keepPayloads]
]

for (const [name, fixtureName, change, edit] of invalidItemCases) {
  test(`장비 아이템 사례(${name})는 엔진을 부르지 않고 ${INVALID_REQUEST}로 거절한다`, async (t) => {
    const { payloads, details, path } = fixture(fixtureName, undefined, equipmentItemDetails)
    const { slotId, ...fields } = change
    const wornItems = structuredClone(payloads.equipment.equipment) as unknown[]
    edit(payloads)
    const engine = scoring(versionedEngine(OATH_ENGINE))
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, {
      equipment: [itemChange(wornItems, slotId as string, fields)]
    })

    assert.deepEqual(response, { status: 400, body: { error: { code: INVALID_REQUEST } } })
    assert.equal(engine.requests.length, 0)
  })
}

function oathOf(payloads: CharacterPayloads): Item {
  return payloads.oath.oath as Item
}

const invalidOathCases: readonly (readonly [string, unknown, PayloadEdit])[] = [
  ['원본에 없는 슬롯', [{ slotNo: 11, tune: 1 }], keepPayloads],
  [
    '서약이 없는 캐릭터',
    [{ slotNo: 0, tune: 1 }],
    (payloads) => {
      payloads.oath = { ...payloads.oath, oath: null }
    }
  ],
  ['조율 단계 밖', [{ slotNo: 0, tune: 4 }], keepPayloads],
  ['조율할 수 없는 태초 결정', [{ slotNo: 8, tune: 1 }], keepPayloads],
  [
    '조율 단계를 모르는 결정',
    [{ slotNo: 0, tune: 1 }],
    (payloads) => {
      const crystals = oathOf(payloads).crystal as Item[]
      oathOf(payloads).crystal = crystals.map((crystal) =>
        crystal.slotNo === 0 ? { ...crystal, itemName: '없는 결정' } : crystal
      )
    }
  ],
  [
    '중복 슬롯',
    [
      { slotNo: 0, tune: 1 },
      { slotNo: 0, tune: 2 }
    ],
    keepPayloads
  ],
  ['문자열 조율', [{ slotNo: 0, tune: '1' }], keepPayloads],
  ['모르는 칸', [{ slotNo: 0, tune: 1, setPoint: 999 }], keepPayloads],
  ['배열이 아닌 서약', { slotNo: 0, tune: 1 }, keepPayloads]
]

for (const [name, oath, edit] of invalidOathCases) {
  test(`서약 결정 사례(${name})는 엔진을 부르지 않고 ${INVALID_REQUEST}로 거절한다`, async (t) => {
    const { payloads, details, path } = fixture('buffer-muse')
    edit(payloads)
    const engine = scoring(versionedEngine(OATH_ENGINE))
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, { equipment: [], oath })

    assert.deepEqual(response, { status: 400, body: { error: { code: INVALID_REQUEST } } })
    assert.equal(engine.requests.length, 0)
  })
}

const REAL_ITEM_ENGINE = realEngineSupports({ equipmentItems: true })

// 엔진 버전이 오르면 점수가 바뀌므로 값은 고정하지 않고 원본과의 관계만 확인한다.
test('실제 엔진은 딜러의 레전더리 상의를 에픽으로, 에픽 반지를 유일 장비로 바꾸면 점수를 올리고 조율을 올리면 내리지 않는다', {
  skip: !REAL_ITEM_ENGINE && '장비 아이템과 조율 교체를 반영하는 0.7.0 이상 엔진이 없음',
  timeout: 60_000
}, async (t) => {
  const { payloads, details, path } = fixture('dealer-blade', undefined, equipmentItemDetails)
  const origin = await listen(t, { details, scoreLibraryPath: REAL_SCORE_LIBRARY_PATH })
  const items = payloads.equipment.equipment as unknown[]
  const scoresOf = async (fields: Item) => {
    const { slotId, ...change } = fields
    const response = await simulate(origin, path, {
      equipment: [itemChange(items, slotId as string, change)]
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.simulated.skipped, null, JSON.stringify(fields))

    return response.body as { baseline: { value: number }; simulated: { value: number } }
  }

  const epic = await scoresOf({ slotId: 'JACKET', variantId: PURIFICATION_EPIC_JACKET })
  assert.ok(epic.simulated.value > epic.baseline.value)

  const exalted = await scoresOf({ slotId: 'RING', variantId: EXALTED_RING })
  assert.ok(exalted.simulated.value > exalted.baseline.value)

  const tuned = await scoresOf({ slotId: 'JACKET', tune: 3 })
  assert.ok(tuned.simulated.value >= tuned.baseline.value)
})

const REAL_OATH_ENGINE = realEngineSupports({ oathTunes: true })

// 엔진 버전이 오르면 점수가 바뀌므로 값은 고정하지 않고 원본과의 관계만 확인한다.
test('실제 엔진은 서약 결정만 바꾼 요청을 건너뛰지 않고 계산해, 딜러의 조율을 올리면 점수가 오르고 버퍼의 조율을 내리면 내려간다', {
  skip: !REAL_OATH_ENGINE && '서약 결정 조율을 반영하는 0.8.0 이상 엔진이 없음',
  timeout: 60_000
}, async (t) => {
  const scoresOf = async (name: FixtureName, oath: unknown[]) => {
    const { details, path } = fixture(name)
    const origin = await listen(t, { details, scoreLibraryPath: REAL_SCORE_LIBRARY_PATH })
    const response = await simulate(origin, path, { equipment: [], oath })

    assert.equal(response.status, 200)
    assert.equal(response.body.baseline.skipped, null, `${name} ${JSON.stringify(oath)}`)
    assert.equal(response.body.simulated.skipped, null, `${name} ${JSON.stringify(oath)}`)

    return response.body as {
      baseline: { calculator: string; value: number }
      simulated: { calculator: string; value: number }
    }
  }

  // 딜러는 유니크, 레어 결정이 모두 0단계이고, 버퍼는 에픽 결정 8개가 3단계다.
  const raised = await scoresOf(
    'dealer-blade',
    [0, 1, 2, 3, 4, 5, 6, 7].map((slotNo) => ({ slotNo, tune: 3 }))
  )
  assert.ok(raised.simulated.value > raised.baseline.value)

  const lowered = await scoresOf(
    'buffer-muse',
    [0, 1, 2, 3, 4, 5, 6, 7].map((slotNo) => ({ slotNo, tune: 0 }))
  )
  assert.equal(lowered.baseline.calculator, 'buff')
  assert.ok(lowered.simulated.value < lowered.baseline.value)
})

const SET_ENGINE = 'dnfscore-native 0.9.0'
const SHADOW_SET = {
  setItemId: '3af7c961e7d8cd8b5b42c5f82af2a0ad',
  setItemName: '그림자에 숨은 죽음 세트'
}
const VALKYRIE_OATH_SET = 16209
const FOX_OATH_SET = 16210
const MANA_OATH_SET = 16212
const SHADOW_EPIC_OATH = 'acde288e06c6a6dda5e2b5d1e606dd00'
const FOX_EPIC_OATH = '6a9706ebcbfe44e754a77c45f8d4a4aa'
const EPIC_MIST_OATH = '316e1b0f26a3a471be2a95e33a315171'
const SHADOW_PRIMAL_CRYSTAL = '5fe3c29985f15b1fdafd4c4d6a247839'
const SHADOW_UNIQUE_CRYSTAL = '5a984f4a7e3e3d7360c183b95b6546bb'
const SHADOW_EPIC_CRYSTAL = '5f722339a3f5c7ef9ba0b290873e19f1'
const VALKYRIE_EPIC_CRYSTAL = '4b842bd9f4b36b3136b05c91d4f1e55b'
const FOX_EPIC_CRYSTAL = '05efe7c9d4cf9f5bd0fc1aa56f1cf157'

function crystalsOf(payloads: CharacterPayloads): Item[] {
  return (payloads.oath.oath as Item).crystal as Item[]
}

function oathItem(itemId: string, itemName: string, itemRarity: string) {
  return { itemId, itemName, itemRarity }
}

test('장비 세트를 고르면 11부위를 새 세트의 같은 등급으로 바꾸고 조율 단계를 유지한다', async (t) => {
  const { payloads, details, path } = fixture('dealer-blade', undefined, equipmentItemDetails)
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipmentSet: SHADOW_SET.setItemId,
    equipment: []
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.simulated.value, 1802)
  const { input } = engine.requests[0]!
  const replaced = bySlot(input.simulation!.equipment)
  // 원본 조율은 상의 2단계, 신발 1단계이고 나머지는 0단계다.
  const expected = {
    JACKET: ['c28adff4d999079e03626b5b04f0a7cc', '어두운 그림자를 입은 죽음 상의', 2, 185],
    SHOULDER: ['cec8dadc0b87a2faa188ba4dacfbb32b', '어두운 그림자가 드리운 얼굴', 0, 165],
    PANTS: ['88c015be8ad68d67fb35cfa693dbe639', '어두운 그림자를 녹여내는 하의', 0, 165],
    SHOES: ['2dee8e5022e85c907d129922477b81e6', '옅은 그림자의 걸음', 1, 125],
    WAIST: ['32b763107adb97a3f1f2717ad92f1995', '어두운 그림자를 자아내는 벨트', 0, 165],
    AMULET: ['ce90fd8107a2dec651b9f7c41a84888c', '칠흑같은 그림자 속 목걸이 - 혈', 0, 265],
    WRIST: ['2b7b57418c2c75fc74d1cdebe44147bb', '어두운 그림자 속 팔찌 - 화', 0, 165],
    RING: ['21753478bab6cd9d3f5265ae36abc34d', '짙은 그림자 속 반지 - 독', 0, 215],
    SUPPORT: ['d02a39cfb1501bcc8453229b7f85a43e', '어두운 그림자 속 보조장비 - 예', 0, 165],
    MAGIC_STON: ['1585efdc5a6a16de5fa29d55e956665b', '짙은 그림자 속 마법석 - 폭', 0, 215],
    EARRING: ['6f89828858bb37275f88e02e54b4e94f', '옅은 그림자 속 귀걸이 - 전', 0, 115]
  } as const
  assert.deepEqual(Object.keys(replaced).sort(), Object.keys(expected).sort())
  for (const [slotId, [itemId, itemName, level, setPoint]] of Object.entries(expected)) {
    assert.deepEqual(
      replaced[slotId],
      {
        ...itemOf(items, slotId),
        ...detailFields(itemId),
        ...SHADOW_SET,
        itemName,
        tune: [{ level, setPoint }]
      },
      slotId
    )
    assert.deepEqual(input.items[itemId], equipmentItemDetails[itemId], slotId)
  }
})

test('5축성 캐릭터의 장비 세트를 바꾸면 새 세트의 공용 이름 아이템과 흑아로 바꾸고 유일 장비는 그대로 둔다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse', undefined, equipmentItemDetails)
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const response = await simulate(origin, path, {
    equipmentSet: SHADOW_SET.setItemId,
    equipment: []
  })

  assert.equal(response.status, 200)
  const replaced = bySlot(engine.requests[0]!.input.simulation!.equipment)
  const expected = {
    JACKET: ['ce653434e129a67945878c1c2e66ce73', '긍휼 속 자비의 상의', 235],
    SHOULDER: ['cd5697ca4f68d2f06b5965ee2fc5662b', '숭고한 심판의 어깨', 235],
    PANTS: ['2fe1185d9c958b52272cf57f36ffbc80', '명예로운 공경의 하의', 235],
    SHOES: ['2912e0efaa521dbceef5b00e7b29fd43', '고요한 안식의 신발', 235],
    WAIST: ['6195206e63ffc979e7cd8c0ae01ebfd3', '완전한 침묵의 벨트', 235],
    AMULET: ['31259fd7ac677855394e80a8e37fd5e9', '흑아 : 칠흑같은 그림자 속 목걸이 - 혈', 265],
    WRIST: ['5e88d49f703473fd5227d4fd32a3981e', '흑아 : 칠흑같은 그림자 속 팔찌 - 화', 265],
    RING: ['e6ffc6ca5528bb4250770f6bce91e47a', '흑아 : 칠흑같은 그림자 속 반지 - 독', 265],
    MAGIC_STON: ['97a123ba55e5a3808dacb1f295871216', '무결한 순수의 마법석', 215],
    EARRING: ['ff2594fc8475d76fcb2fbb080a8467d1', '강인한 절제의 귀걸이', 215]
  } as const
  assert.deepEqual(Object.keys(replaced).sort(), Object.keys(expected).sort())
  for (const [slotId, [itemId, itemName, setPoint]] of Object.entries(expected)) {
    const consecrate = slotId in PURIFICATION_CONSECRATED ? { consecrate: true } : {}

    assert.deepEqual(
      replaced[slotId],
      {
        ...withoutKeys(itemOf(items, slotId), ['consecrate']),
        ...detailFields(itemId),
        ...SHADOW_SET,
        ...consecrate,
        itemName,
        tune: [{ level: 0, setPoint }]
      },
      slotId
    )
  }
})

test('장비 세트를 고른 뒤 부위별 등급은 새 세트의 선택지로 고르고, 원래 세트의 선택지는 거절한다', async (t) => {
  const { payloads, details, path } = fixture('dealer-blade', undefined, equipmentItemDetails)
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]

  const shadow = await simulate(origin, path, {
    equipmentSet: SHADOW_SET.setItemId,
    equipment: [itemChange(items, 'JACKET', { variantId: SHADOW_EPIC_JACKET })]
  })
  const purification = await simulate(origin, path, {
    equipmentSet: SHADOW_SET.setItemId,
    equipment: [itemChange(items, 'JACKET', { variantId: PURIFICATION_EPIC_JACKET })]
  })

  assert.equal(shadow.status, 200)
  const jacket = bySlot(engine.requests[0]!.input.simulation!.equipment).JACKET!
  assert.equal(jacket.itemName, '짙은 그림자를 입은 죽음 상의')
  assert.deepEqual(jacket.tune, [{ level: 2, setPoint: 235 }])
  assert.deepEqual(purification, { status: 400, body: { error: { code: INVALID_REQUEST } } })
  assert.equal(engine.requests.length, 1)
})

test('무기 조율을 바꾸면 원본 무기 항목의 첫 조율 단계만 바꾸고 표시값은 그대로 둔다', async (t) => {
  const { payloads, details, path } = fixture('dealer-blade')
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const items = payloads.equipment.equipment as unknown[]
  const weapon = itemOf(items, 'WEAPON')
  const [tune] = weapon.tune as Item[]

  const response = await simulate(origin, path, {
    equipment: [itemChange(items, 'WEAPON', { tune: 3 })]
  })

  assert.equal(response.status, 200)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [{ ...weapon, amplificationName: null, tune: [{ ...tune, level: 3 }] }]
  })
})

test('서약 세트를 고르면 세트 전용 본체와 광휘 결정을 새 세트의 같은 등급으로 바꾸고 조율 단계를 유지한다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse')
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const crystals = crystalsOf(payloads)

  const response = await simulate(origin, path, { equipment: [], oathSet: FOX_OATH_SET })

  assert.equal(response.status, 200)
  const info = (payloads.oath.oath as Item).info as Item
  // 버퍼는 에픽 결정 8개가 3단계(195), 태초 결정 3개가 0단계(205)다.
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [],
    oath: {
      info: {
        ...info,
        ...oathItem('15a42c9cfd0709f609b22bb590f0a1e8', '강림한 여우 서약', '태초'),
        setPoint: 655
      },
      set: { setId: FOX_OATH_SET },
      crystal: crystals.map((crystal, index) => {
        if (index < 8) {
          return {
            ...crystal,
            ...oathItem(FOX_EPIC_CRYSTAL, '여우 : 완전한 광휘 결정', '에픽'),
            tune: { level: 3, setPoint: 195 }
          }
        }

        return {
          ...crystal,
          ...oathItem('c78cae5798f4b3d8991323d6e9274463', '여우 : 태초의 광휘 결정', '태초'),
          tune: { level: 0, setPoint: 205 }
        }
      })
    }
  })
})

test('서약 세트를 바꿔도 영겁의 안개 서약 본체와 광휘가 아닌 결정은 그대로 두고, 원본과 같은 세트를 골라 옮길 것이 없으면 원본만 계산한다', async (t) => {
  const { payloads, details, path } = fixture('dealer-blade')
  const section = payloads.oath.oath as Item
  section.info = {
    ...(section.info as Item),
    ...oathItem(EPIC_MIST_OATH, '영겁의 안개 서약', '에픽')
  }
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const crystals = crystalsOf(payloads)

  const moved = await simulate(origin, path, { equipment: [], oathSet: MANA_OATH_SET })
  const same = await simulate(origin, path, { equipment: [], oathSet: VALKYRIE_OATH_SET })

  assert.equal(moved.status, 200)
  // 딜러는 발키리 유니크 광휘 결정 8개와 미광의 서약 결정 3개다.
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [],
    oath: {
      set: { setId: MANA_OATH_SET },
      crystal: crystals.slice(0, 8).map((crystal) => ({
        ...crystal,
        ...oathItem('e3f4ca0fc46dba190b74820740a97863', '마력 : 희미한 광휘 결정', '유니크'),
        tune: { level: 0, setPoint: 85 }
      }))
    }
  })
  assert.deepEqual(same.body, {
    baseline: {
      ...cardScore('equipment', 1741),
      versions: { ...cardVersions, package: SET_ENGINE }
    },
    simulated: {
      ...cardScore('equipment', 1741),
      versions: { ...cardVersions, package: SET_ENGINE }
    }
  })
  assert.equal(engine.requests[1]!.input.simulation, undefined)
})

test('서약 본체 등급은 서약 세트를 옮긴 뒤의 계열에서 고르고 본체 칸만 바꾼다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse')
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })
  const info = (payloads.oath.oath as Item).info as Item

  const kept = await simulate(origin, path, { equipment: [], oathBody: SHADOW_EPIC_OATH })
  const moved = await simulate(origin, path, {
    equipment: [],
    oathSet: FOX_OATH_SET,
    oathBody: FOX_EPIC_OATH
  })

  assert.equal(kept.status, 200)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [],
    oath: {
      info: {
        ...info,
        ...oathItem(SHADOW_EPIC_OATH, '짙은 어둠 속 그림자 서약', '에픽'),
        setPoint: 455
      }
    }
  })
  assert.equal(moved.status, 200)
  const oath = engine.requests[1]!.input.simulation!.oath!
  assert.equal(oath.info?.itemName, '빙의된 여우 서약')
  assert.deepEqual(oath.set, { setId: FOX_OATH_SET })
})

test('결정 등급을 바꾸면 조율 단계를 새 결정의 최대 단계로 자르고, 함께 보낸 조율은 새 결정으로 검증하며 광휘가 아닌 결정도 바꿀 수 있다', async (t) => {
  const buffer = fixture('buffer-muse')
  const dealer = fixture('dealer-blade')
  const engine = scoring(versionedEngine(SET_ENGINE))
  const bufferOrigin = await listen(t, { details: buffer.details, ...engine.options })
  const dealerOrigin = await listen(t, { details: dealer.details, ...engine.options })
  const bufferCrystals = crystalsOf(buffer.payloads)
  const dealerCrystals = crystalsOf(dealer.payloads)

  const bufferResponse = await simulate(bufferOrigin, buffer.path, {
    equipment: [],
    oath: [
      { slotNo: 0, variantId: SHADOW_PRIMAL_CRYSTAL },
      { slotNo: 1, variantId: SHADOW_UNIQUE_CRYSTAL, tune: 2 },
      { slotNo: 8, variantId: SHADOW_EPIC_CRYSTAL }
    ]
  })
  const dealerResponse = await simulate(dealerOrigin, dealer.path, {
    equipment: [],
    oath: [{ slotNo: 8, variantId: VALKYRIE_EPIC_CRYSTAL }]
  })

  assert.equal(bufferResponse.status, 200)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [],
    oath: {
      crystal: [
        {
          ...bufferCrystals[0],
          ...oathItem(SHADOW_PRIMAL_CRYSTAL, '그림자 : 태초의 광휘 결정', '태초'),
          tune: { level: 0, setPoint: 205 }
        },
        {
          ...bufferCrystals[1],
          ...oathItem(SHADOW_UNIQUE_CRYSTAL, '그림자 : 희미한 광휘 결정', '유니크'),
          tune: { level: 2, setPoint: 105 }
        },
        {
          ...bufferCrystals[8],
          ...oathItem(SHADOW_EPIC_CRYSTAL, '그림자 : 완전한 광휘 결정', '에픽'),
          tune: { level: 0, setPoint: 165 }
        }
      ]
    }
  })
  assert.equal(dealerResponse.status, 200)
  assert.deepEqual(engine.requests[1]!.input.simulation, {
    equipment: [],
    oath: {
      crystal: [
        {
          ...dealerCrystals[8],
          ...oathItem(VALKYRIE_EPIC_CRYSTAL, '발키리 : 완전한 광휘 결정', '에픽'),
          tune: { level: 0, setPoint: 165 }
        }
      ]
    }
  })
})

// 버퍼는 태초 결정 3개(slot 8~10)를 낀 상태다.
for (const [name, oath, expected] of [
  [
    '결정 하나를 태초로 올려 4개가 되면 거절한다',
    [{ slotNo: 0, variantId: SHADOW_PRIMAL_CRYSTAL }],
    400
  ],
  [
    '태초로 올리면서 다른 태초를 에픽으로 내려 3개면 받는다',
    [
      { slotNo: 0, variantId: SHADOW_PRIMAL_CRYSTAL },
      { slotNo: 8, variantId: SHADOW_EPIC_CRYSTAL }
    ],
    200
  ],
  ['결정을 바꾸지 않고 조율만 바꾸면 태초 수를 보지 않는다', [{ slotNo: 0, tune: 2 }], 200]
] as const) {
  test(`태초 결정 상한: ${name}`, async (t) => {
    const { payloads, details, path } = fixture('buffer-muse')
    const engine = scoring(versionedEngine(SET_ENGINE))
    const origin = await listen(t, { details, ...engine.options })

    const response = await simulate(origin, path, { equipment: [], oath })

    assert.equal(response.status, expected)
    assert.equal(engine.requests.length, expected === 200 ? 1 : 0)

    if (expected === 200) {
      const crystals = engine.requests[0]!.input.simulation!.oath!.crystal!
      const final = crystalsOf(payloads).map(
        (crystal) => crystals.find(({ slotNo }) => slotNo === crystal.slotNo) ?? crystal
      )
      assert.ok(final.filter(({ itemRarity }) => itemRarity === '태초').length <= 3)
    }
  })
}

type SimulationCheck = (simulation: ScoreSimulationInput) => void

const noCheck: SimulationCheck = () => undefined

const VARIANT_SLOTS = [
  'AMULET',
  'EARRING',
  'JACKET',
  'MAGIC_STON',
  'PANTS',
  'RING',
  'SHOES',
  'SHOULDER',
  'SUPPORT',
  'WAIST',
  'WRIST'
]

const switchedToShadow: SimulationCheck = ({ equipment, oath }) => {
  const replaced = bySlot(equipment)

  assert.deepEqual(Object.keys(replaced).sort(), VARIANT_SLOTS)
  for (const [slotId, entry] of Object.entries(replaced)) {
    const { setItemId, setItemName } = entry

    assert.deepEqual({ setItemId, setItemName }, SHADOW_SET, slotId)
  }
  assert.equal(oath, undefined)
}

const weaponTunedAndOathMoved: SimulationCheck = ({ equipment, oath }) => {
  const replaced = bySlot(equipment)
  const [tune] = replaced.WEAPON!.tune as Item[]

  assert.deepEqual(Object.keys(replaced), ['WEAPON'])
  assert.equal(tune!.level, 1)
  assert.deepEqual(oath?.set, { setId: MANA_OATH_SET })
}

for (const [name, package_, body, expected, check] of [
  [
    '0.9.0 전 엔진에 장비 세트 전환을 보내면 두 점수 모두 null이다',
    OATH_ENGINE,
    { equipmentSet: SHADOW_SET.setItemId, equipment: [] },
    null,
    noCheck
  ],
  [
    '0.9.0 전 엔진에 무기 조율을 보내면 두 점수 모두 null이다',
    OATH_ENGINE,
    { equipment: [{ slotId: 'WEAPON', tune: 1 }] },
    null,
    noCheck
  ],
  [
    '0.9.0 전 엔진에 서약 세트 전환을 보내면 두 점수 모두 null이다',
    OATH_ENGINE,
    { equipment: [], oathSet: MANA_OATH_SET },
    null,
    noCheck
  ],
  [
    '0.9.0 전 엔진에 결정 등급 교체를 보내면 두 점수 모두 null이다',
    OATH_ENGINE,
    { equipment: [], oath: [{ slotNo: 0, variantId: VALKYRIE_EPIC_CRYSTAL }] },
    null,
    noCheck
  ],
  [
    '0.9.0 전 엔진도 결정 조율만 바꾼 요청은 점수를 낸다',
    OATH_ENGINE,
    { equipment: [], oath: [{ slotNo: 0, tune: 1 }] },
    1802,
    noCheck
  ],
  [
    '0.9.0 엔진은 장비 세트 전환을 반영한다',
    SET_ENGINE,
    { equipmentSet: SHADOW_SET.setItemId, equipment: [] },
    1802,
    switchedToShadow
  ],
  [
    '0.9.0 엔진은 무기 조율과 서약 세트 전환을 반영한다',
    SET_ENGINE,
    { equipment: [{ slotId: 'WEAPON', tune: 1 }], oathSet: MANA_OATH_SET },
    1802,
    weaponTunedAndOathMoved
  ]
] as const) {
  test(`엔진 버전: ${name}`, async (t) => {
    const { payloads, details, path } = fixture('dealer-blade', undefined, equipmentItemDetails)
    const engine = scoring(versionedEngine(package_))
    const origin = await listen(t, { details, ...engine.options })
    const items = payloads.equipment.equipment as unknown[]
    const equipment = body.equipment.map(({ slotId, ...fields }) =>
      itemChange(items, slotId, fields)
    )

    const response = await simulate(origin, path, { ...body, equipment })

    assert.equal(response.status, 200)
    assert.equal(response.body.simulated?.value ?? null, expected)
    assert.equal(engine.requests.length, 1)
    check(engine.requests[0]!.input.simulation!)
  })
}

const invalidSetCases: readonly (readonly [string, FixtureName, Item, PayloadEdit])[] = [
  [
    '목록에 없는 장비 세트',
    'dealer-blade',
    { equipmentSet: 'ffffffffffffffffffffffffffffffff', equipment: [] },
    keepPayloads
  ],
  ['문자열이 아닌 장비 세트', 'dealer-blade', { equipmentSet: 1, equipment: [] }, keepPayloads],
  [
    '최대 단계를 넘는 무기 조율',
    'dealer-blade',
    { equipment: [{ slotId: 'WEAPON', tune: 4 }] },
    keepPayloads
  ],
  [
    '조율할 수 없는 무기의 조율',
    'buffer-muse',
    { equipment: [{ slotId: 'WEAPON', tune: 0 }] },
    keepPayloads
  ],
  ['목록에 없는 서약 세트', 'buffer-muse', { equipment: [], oathSet: 16213 }, keepPayloads],
  [
    '서약 세트 정보가 없는 캐릭터의 서약 세트 전환',
    'buffer-muse',
    { equipment: [], oathSet: FOX_OATH_SET },
    (payloads) => {
      const { setInfo: _setInfo, ...section } = payloads.oath.oath as Item
      payloads.oath = { ...payloads.oath, oath: section }
    }
  ],
  [
    '서약이 없는 캐릭터의 서약 세트 전환',
    'buffer-muse',
    { equipment: [], oathSet: FOX_OATH_SET },
    (payloads) => {
      payloads.oath = { ...payloads.oath, oath: null }
    }
  ],
  ['다른 계열의 본체', 'buffer-muse', { equipment: [], oathBody: FOX_EPIC_OATH }, keepPayloads],
  [
    '세트를 옮기기 전 계열의 본체',
    'buffer-muse',
    { equipment: [], oathSet: FOX_OATH_SET, oathBody: SHADOW_EPIC_OATH },
    keepPayloads
  ],
  [
    '세트 전용 본체를 낀 캐릭터의 안개 서약 본체',
    'buffer-muse',
    { equipment: [], oathBody: EPIC_MIST_OATH },
    keepPayloads
  ],
  [
    '선택 목록에 없는 본체의 등급 교체',
    'buffer-muse',
    { equipment: [], oathBody: SHADOW_EPIC_OATH },
    (payloads) => {
      const section = payloads.oath.oath as Item
      section.info = {
        ...(section.info as Item),
        ...oathItem('00000000000000000000000000000000', '레어 서약', '레어')
      }
    }
  ],
  [
    '다른 서약 세트의 결정',
    'buffer-muse',
    { equipment: [], oath: [{ slotNo: 0, variantId: FOX_EPIC_CRYSTAL }] },
    keepPayloads
  ],
  [
    '새 결정의 단계 밖 조율',
    'buffer-muse',
    { equipment: [], oath: [{ slotNo: 0, variantId: SHADOW_PRIMAL_CRYSTAL, tune: 1 }] },
    keepPayloads
  ],
  [
    '문자열이 아닌 결정 선택지 id',
    'buffer-muse',
    { equipment: [], oath: [{ slotNo: 0, variantId: 1 }] },
    keepPayloads
  ],
  ['정수가 아닌 서약 세트', 'buffer-muse', { equipment: [], oathSet: '16210' }, keepPayloads]
]

for (const [name, fixtureName, body, edit] of invalidSetCases) {
  test(`세트, 서약, 무기 사례(${name})는 엔진을 부르지 않고 ${INVALID_REQUEST}로 거절한다`, async (t) => {
    const { payloads, details, path } = fixture(fixtureName, undefined, equipmentItemDetails)
    const items = structuredClone(payloads.equipment.equipment) as unknown[]
    edit(payloads)
    const engine = scoring(versionedEngine(SET_ENGINE))
    const origin = await listen(t, { details, ...engine.options })
    const equipment = (body.equipment as Item[]).map(({ slotId, ...fields }) =>
      itemChange(items, slotId as string, fields)
    )

    const response = await simulate(origin, path, { ...body, equipment })

    assert.deepEqual(response, { status: 400, body: { error: { code: INVALID_REQUEST } } })
    assert.equal(engine.requests.length, 0)
  })
}

const REAL_SET_ENGINE = realEngineSupports({
  equipmentSet: true,
  weaponTune: true,
  oathItems: true
})

// 엔진 버전이 오르면 점수가 바뀌므로 값은 고정하지 않고 원본과의 관계만 확인한다.
test('실제 엔진은 장비 세트, 서약 세트, 본체와 결정 등급, 무기 조율을 바꾼 요청을 건너뛰지 않고 계산한다', {
  skip: !REAL_SET_ENGINE && '세트, 서약, 무기 조율 교체를 반영하는 0.9.0 이상 엔진이 없음',
  timeout: 60_000
}, async (t) => {
  const scoresOf = async (name: FixtureName, body: Item) => {
    const { payloads, details, path } = fixture(name, undefined, equipmentItemDetails)
    const origin = await listen(t, { details, scoreLibraryPath: REAL_SCORE_LIBRARY_PATH })
    const items = payloads.equipment.equipment as unknown[]
    const equipment = ((body.equipment ?? []) as Item[]).map(({ slotId, ...fields }) =>
      itemChange(items, slotId as string, fields)
    )
    const response = await simulate(origin, path, { ...body, equipment })

    assert.equal(response.status, 200)
    assert.equal(response.body.baseline.skipped, null, `${name} ${JSON.stringify(body)}`)
    assert.equal(response.body.simulated.skipped, null, `${name} ${JSON.stringify(body)}`)

    return response.body as { baseline: { value: number }; simulated: { value: number } }
  }

  // 같은 등급끼리 옮긴 세트는 점수가 같을 수 있어, 옮긴 세트에서 등급을 올린 쪽이 더 높은지로 본다.
  const equipmentSet = await scoresOf('dealer-blade', { equipmentSet: SHADOW_SET.setItemId })
  const epicJacket = await scoresOf('dealer-blade', {
    equipmentSet: SHADOW_SET.setItemId,
    equipment: [{ slotId: 'JACKET', variantId: SHADOW_EPIC_JACKET }]
  })
  assert.ok(epicJacket.simulated.value > equipmentSet.simulated.value)

  await scoresOf('buffer-muse', { equipmentSet: SHADOW_SET.setItemId })
  // 딜러 서약 포인트(865)는 서약 세트 1번 선택지 표에 행이 없어 엔진이 건너뛰므로 버퍼로 확인한다.
  await scoresOf('buffer-muse', { oathSet: FOX_OATH_SET })

  // 버퍼의 본체는 태초라 에픽으로 내리면 점수가 내려간다.
  const lowerBody = await scoresOf('buffer-muse', { oathBody: SHADOW_EPIC_OATH })
  assert.ok(lowerBody.simulated.value < lowerBody.baseline.value)

  // 딜러의 결정은 유니크라 에픽으로 올리면 점수가 오른다.
  const higherCrystal = await scoresOf('dealer-blade', {
    oath: [{ slotNo: 0, variantId: VALKYRIE_EPIC_CRYSTAL }]
  })
  assert.ok(higherCrystal.simulated.value > higherCrystal.baseline.value)

  const weapon = await scoresOf('dealer-blade', { equipment: [{ slotId: 'WEAPON', tune: 3 }] })
  assert.ok(weapon.simulated.value > weapon.baseline.value)
})

test('착용한 서약 세트를 다시 고르면 다른 세트의 본체와 광휘 결정만 그 세트의 같은 등급으로 옮기고 세트 칸은 넣지 않는다', async (t) => {
  const { payloads, details, path } = fixture('buffer-muse')
  const section = payloads.oath.oath as Item
  const foxBody = oathItem('15a42c9cfd0709f609b22bb590f0a1e8', '강림한 여우 서약', '태초')
  section.info = { ...(section.info as Item), ...foxBody }
  section.crystal = crystalsOf(payloads).map((crystal) =>
    crystal.slotNo === 2
      ? { ...crystal, ...oathItem(FOX_EPIC_CRYSTAL, '여우 : 완전한 광휘 결정', '에픽') }
      : crystal
  )
  const crystals = crystalsOf(payloads)
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, { equipment: [], oathSet: 16201 })

  assert.equal(response.status, 200)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [],
    oath: {
      info: {
        ...(section.info as Item),
        ...oathItem('72adf78e645d9a821b9adcc98ef00044', '태초의 어둠 속 그림자 서약', '태초'),
        setPoint: 655
      },
      crystal: [
        {
          ...crystals[2],
          ...oathItem(SHADOW_EPIC_CRYSTAL, '그림자 : 완전한 광휘 결정', '에픽'),
          tune: { level: 3, setPoint: 195 }
        }
      ]
    }
  })
})

test('세트가 섞인 캐릭터가 주 세트를 고르면 다른 세트를 낀 부위만 주 세트의 같은 등급으로 옮긴다', async (t) => {
  // 원본 상의(칠흑의 정화 레전더리, 조율 2단계)를 그림자 세트 레전더리로 바꿔 세트를 섞는다.
  const { original, details, path } = fixture(
    'dealer-blade',
    (entries) =>
      entries.map((entry) =>
        entry.slotId === 'JACKET'
          ? {
              ...entry,
              ...SHADOW_SET,
              itemId: 'c28adff4d999079e03626b5b04f0a7cc',
              itemName: '어두운 그림자를 입은 죽음 상의'
            }
          : entry
      ),
    equipmentItemDetails
  )
  const engine = scoring(versionedEngine(SET_ENGINE))
  const origin = await listen(t, { details, ...engine.options })

  const response = await simulate(origin, path, {
    equipmentSet: PURIFICATION_SET.setItemId,
    equipment: []
  })

  assert.equal(response.status, 200)
  assert.deepEqual(engine.requests[0]!.input.simulation, {
    equipment: [itemOf(original.equipment.equipment as unknown[], 'JACKET')]
  })
})
