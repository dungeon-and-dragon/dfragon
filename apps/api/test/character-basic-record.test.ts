import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import {
  type CharacterBasicInput,
  type CharacterScoreInput,
  type CharacterSkillStyleInput,
  type DatabaseClient,
  recordCharacter,
  recordCharacterBasic
} from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { CatalogService } from '../src/application/character-catalog/service.js'
import type {
  CharacterPayload,
  CharacterPayloads
} from '../src/domain/character-detail/sections.js'
import type { ScoreEngineResult } from '../src/domain/score/result.js'
import type { ScoreWorker } from '../src/infrastructure/score/engine.js'
import type { ScoreWorkerMessage } from '../src/infrastructure/score/worker-protocol.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/runtime/api-app.js'
import { createApiRuntimeOptions } from '../src/runtime/application.js'

// 합성 캐릭터다. 실제 Neople 응답처럼 모든 섹션에 기본 정보가 들어 있다.
const character = { serverId: 'cain', characterId: 'basic-fixture' }
const basicFields = {
  ...character,
  characterName: '합성기본',
  level: 115,
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  adventureName: '합성모험단',
  guildId: 'synthetic-guild',
  guildName: '합성길드',
  fame: 61234
}
const greatestMaxFamePattern = /GREATEST\("max_fame", \?::integer\)/
const advisoryLockPattern = 'pg_advisory_xact_lock'

function characterDatabase() {
  let stored: { fame: number | null; maxFame: number | null } | null = null
  const transaction = {
    $executeRaw: async (sql: TemplateStringsArray, ...values: (number | string)[]) => {
      if (sql.join('?').includes(advisoryLockPattern)) {
        return 1
      }
      assert.match(sql.join('?'), greatestMaxFamePattern)
      assert.ok(stored)
      const fame = values[0]
      assert.ok(typeof fame === 'number')
      stored.maxFame = Math.max(stored.maxFame ?? fame, fame)

      return 1
    },
    adventure: {
      findFirst: async () => ({ id: 1n }),
      update: async () => undefined
    },
    character: {
      findUnique: async () => (stored === null ? null : { adventureId: 1n }),
      create: async ({ data }: { data: { fame?: number | null; maxFame: number | null } }) => {
        stored = { fame: data.fame ?? null, maxFame: data.maxFame }
      },
      update: async ({ data }: { data: { fame?: number | null } }) => {
        assert.ok(stored)
        if (data.fame !== undefined) {
          stored.fame = data.fame
        }
      }
    },
    characterCollection: { deleteMany: async () => undefined }
  }
  const client = {
    $transaction: async (callback: (value: typeof transaction) => Promise<void>) =>
      callback(transaction)
  } as unknown as DatabaseClient

  return { client, read: () => stored }
}

test('처음 저장한 명성을 최고 명성으로 기록한다', async () => {
  const database = characterDatabase()
  await recordCharacterBasic(database.client, basicFields)
  assert.deepEqual(database.read(), { fame: 61234, maxFame: 61234 })
})

for (const [name, fame, maxFame] of [
  ['더 낮은 명성을 저장하면 최고 명성을 유지한다', 50000, 61234],
  ['더 높은 명성을 저장하면 최고 명성을 갱신한다', 70000, 70000],
  ['null 명성을 저장하면 최고 명성을 유지한다', null, 61234]
] as const) {
  test(name, async () => {
    const database = characterDatabase()
    await recordCharacterBasic(database.client, basicFields)
    await recordCharacterBasic(database.client, { ...basicFields, fame })
    assert.deepEqual(database.read(), { fame, maxFame })
  })
}

test('명성 없이 처음 저장하면 최고 명성도 null이다', async () => {
  const database = characterDatabase()
  await recordCharacterBasic(database.client, { ...basicFields, fame: null })
  assert.deepEqual(database.read(), { fame: null, maxFame: null })
})

test('명성을 전달하지 않는 저장은 기존 명성과 최고 명성을 유지한다', async () => {
  const database = characterDatabase()
  await recordCharacterBasic(database.client, basicFields)
  await recordCharacter(database.client, basicFields)
  assert.deepEqual(database.read(), { fame: 61234, maxFame: 61234 })
})

const skillStyle = {
  style: {
    active: [
      { skillId: 'synthetic-active', name: '합성 액티브', level: 13, requiredLevel: 1 },
      { skillId: 'synthetic-evolved', name: '합성 개화', level: 1, requiredLevel: 100 }
    ],
    passive: [{ skillId: 'synthetic-passive', name: '합성 패시브', level: 20, requiredLevel: 1 }],
    evolution: [{ skillId: 'synthetic-evolved', type: 2 }],
    enhancement: [{ skillId: 'synthetic-active', type: 1 }],
    chain: { resetTime: 0, skills: ['synthetic-active'] }
  }
}

function payloadsWith(
  basic: CharacterPayload,
  skill: CharacterPayload = { style: { active: [] } }
): CharacterPayloads {
  return {
    basic,
    status: { ...basic, status: [], buff: [] },
    equipment: { ...basic, equipment: [], setItemInfo: [] },
    avatar: { ...basic, avatar: [] },
    creature: { ...basic, creature: null },
    oath: { ...basic, oath: null },
    mist_assimilation: { ...basic, mistAssimilation: null },
    skill_style: { ...basic, skill },
    buff_equipment: { ...basic, skill: { buff: null } },
    buff_avatar: { ...basic, skill: { buff: null } },
    buff_creature: { ...basic, skill: { buff: null } }
  }
}

async function listen(
  options: Pick<
    ApiHttpAppOptions,
    | 'details'
    | 'timeline'
    | 'recordCharacterBasic'
    | 'recordCharacterSkillStyle'
    | 'recordCharacterScore'
    | 'scoreLibraryPath'
    | 'spawnScoreWorker'
    | 'writeAccessLog'
  >
): Promise<{ app: HttpAppHandle; origin: string }> {
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined,
    ...options
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

// 합성 결과다. 실제 엔진을 열지 않고, worker는 받은 요청마다 이 결과를 돌려주는 fake다.
const engineResult: ScoreEngineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions: { package: 'dnfscore-native 0.4.2', rules_rev: 'rev14', bundle_id: 'phase32-rev14d' },
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}

function scoring(
  result: () => ScoreEngineResult
): Pick<ApiHttpAppOptions, 'scoreLibraryPath' | 'spawnScoreWorker'> {
  const worker = (): ScoreWorker => {
    const events = new EventEmitter()
    const on = events.on.bind(events)
    const reply = (id: number): ScoreWorkerMessage => {
      const text = JSON.stringify(result())

      return { kind: 'result', id, text }
    }

    return {
      postMessage: ({ id }) => {
        queueMicrotask(() => events.emit('message', reply(id)))
      },
      on,
      terminate: async () => undefined
    }
  }

  return { scoreLibraryPath: '/synthetic/libdnfscore.so', spawnScoreWorker: worker }
}

function detailsReturning(payloads: CharacterPayloads): ApiHttpAppOptions['details'] {
  return {
    fetchDetails: async () => payloads,
    catalog: new CatalogService(async () => new Map())
  }
}

async function waitUntil(condition: () => boolean): Promise<void> {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

async function getDetails(origin: string) {
  const response = await fetch(
    new URL(`/characters/${character.serverId}/${character.characterId}`, origin)
  )

  return { status: response.status, body: await response.json() }
}

test('상세 조회는 캐시 적중에도 응답의 기본 정보를 저장한다', async (t) => {
  const recorded: CharacterBasicInput[] = []
  let neopleFetches = 0
  const payloads = payloadsWith(basicFields)
  const { app, origin } = await listen({
    details: {
      fetchDetails: async () => {
        neopleFetches++

        return payloads
      },
      catalog: new CatalogService(async () => new Map())
    },
    recordCharacterBasic: async (basic) => {
      recorded.push(basic)
    }
  })
  t.after(() => app.close())

  const first = await getDetails(origin)
  await getDetails(origin)

  assert.equal(first.status, 200)
  assert.equal(neopleFetches, 1)
  const { serverName: _serverName, ...responseBasic } = first.body.character
  assert.deepEqual(recorded, [responseBasic, responseBasic])
  assert.deepEqual(recorded[0], basicFields)
})

test('길드와 명성이 없는 캐릭터는 길드와 명성을 null로 저장한다', async (t) => {
  const { guildId: _guildId, guildName: _guildName, fame: _fame, ...withoutGuild } = basicFields
  const recorded: CharacterBasicInput[] = []
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(withoutGuild)),
    recordCharacterBasic: async (basic) => {
      recorded.push(basic)
    }
  })
  t.after(() => app.close())

  await getDetails(origin)

  assert.deepEqual(recorded, [{ ...withoutGuild, guildId: null, guildName: null, fame: null }])
})

test('모험단 이름이 없는 캐릭터는 저장하지 않고 상세 응답은 그대로 보낸다', async (t) => {
  const { adventureName: _adventureName, ...withoutAdventure } = basicFields
  const recorded: CharacterBasicInput[] = []
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(withoutAdventure)),
    recordCharacterBasic: async (basic) => {
      recorded.push(basic)
    }
  })
  t.after(() => app.close())

  const { status, body } = await getDetails(origin)

  assert.equal(status, 200)
  assert.equal(body.character.adventureName, null)
  assert.deepEqual(recorded, [])
})

// 받은 시각은 app마다 다르므로 그 시각이 들어간 필드는 비교하지 않는다.
function withoutFetchTimes({
  sections: _sections,
  freshness: _freshness,
  ...content
}: Record<string, unknown>) {
  return content
}

// 실패를 보고하지 않으면 멈추지 않고 실패하도록 timeout을 둔다.
test('기본 정보 저장이 실패해도 상세 응답은 그대로이고 실패 code를 남긴다', {
  timeout: 10_000
}, async (t) => {
  const payloads = payloadsWith(basicFields)
  const codes: string[] = []
  let failureReported!: () => void
  const reported = new Promise<void>((resolve) => {
    failureReported = resolve
  })
  const failing = await listen({
    details: detailsReturning(payloads),
    recordCharacterBasic: async () => {
      throw new Error('database closed')
    },
    writeAccessLog: (line) => {
      const { code } = JSON.parse(line)
      if (code !== undefined) {
        codes.push(code)
        failureReported()
      }
    }
  })
  t.after(() => failing.app.close())
  const withoutDatabase = await listen({ details: detailsReturning(payloads) })
  t.after(() => withoutDatabase.app.close())

  const response = await getDetails(failing.origin)
  const expected = await getDetails(withoutDatabase.origin)
  await reported

  assert.equal(response.status, 200)
  assert.deepEqual(withoutFetchTimes(response.body), withoutFetchTimes(expected.body))
  assert.deepEqual(codes, ['CHARACTER_BASIC_RECORD_FAILED'])
})

test('상세 조회는 기본 정보를 저장한 뒤 받은 시각과 함께 스킬 스타일을 저장하고, 캐시 적중에도 같은 시각으로 저장한다', {
  timeout: 10_000
}, async (t) => {
  let savedBasics = 0
  const savedBasicsBeforeStyle: number[] = []
  const styles: CharacterSkillStyleInput[] = []
  let neopleFetches = 0
  const payloads = payloadsWith(basicFields, skillStyle)
  const { app, origin } = await listen({
    details: {
      fetchDetails: async () => {
        neopleFetches++

        return payloads
      },
      catalog: new CatalogService(async () => new Map())
    },
    recordCharacterBasic: async () => {
      // 기본 정보보다 먼저 저장하면 characters 참조가 깨지므로, 늦게 끝나도 기다리는지 보려고 일부러 늦춘다.
      await new Promise((resolve) => setTimeout(resolve, 20))
      savedBasics++
    },
    recordCharacterSkillStyle: async (style) => {
      savedBasicsBeforeStyle.push(savedBasics)
      styles.push(style)
    }
  })
  t.after(() => app.close())

  const before = Date.now()
  await getDetails(origin)
  // 캐시 적중 때 지금 시각을 쓰면 첫 저장과 달라지도록 두 번째 조회 전에 시각을 넘긴다.
  await new Promise((resolve) => setTimeout(resolve, 10))
  const beforeCachedRequest = Date.now()
  await getDetails(origin)
  await waitUntil(() => styles.length === 2)

  assert.equal(neopleFetches, 1)
  assert.ok(savedBasicsBeforeStyle.every((count, index) => count >= index + 1))
  const [first, second] = styles
  assert.ok(first.fetchedAt.getTime() >= before)
  assert.ok(second.fetchedAt.getTime() < beforeCachedRequest)
  assert.deepEqual(second, first)
  assert.deepEqual(
    { ...first, fetchedAt: undefined },
    {
      ...character,
      jobId: 'synthetic-job',
      jobGrowId: 'synthetic-grow',
      skills: [
        { name: '합성 액티브', level: 13 },
        { name: '합성 개화', level: 1 },
        { name: '합성 패시브', level: 20 }
      ],
      evolutions: [{ name: '합성 개화', type: 2 }],
      enhancements: [{ name: '합성 액티브', type: 1 }],
      fetchedAt: undefined
    }
  )
})

test('스킬 스타일 저장이 실패해도 상세 응답은 그대로이고 실패 code를 남긴다', {
  timeout: 10_000
}, async (t) => {
  const codes: string[] = []
  let failureReported!: () => void
  const reported = new Promise<void>((resolve) => {
    failureReported = resolve
  })
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(basicFields, skillStyle)),
    recordCharacterBasic: async () => undefined,
    recordCharacterSkillStyle: async () => {
      throw new Error('database closed')
    },
    writeAccessLog: (line) => {
      const { code } = JSON.parse(line)
      if (code !== undefined) {
        codes.push(code)
        failureReported()
      }
    }
  })
  t.after(() => app.close())

  const { status, body } = await getDetails(origin)
  await reported

  assert.equal(status, 200)
  assert.equal(body.character.characterName, basicFields.characterName)
  assert.deepEqual(codes, ['CHARACTER_SKILL_STYLE_RECORD_FAILED'])
})

test('기본 정보를 저장하지 못하면 스킬 스타일과 점수도 저장하지 않는다', {
  timeout: 10_000
}, async (t) => {
  const styles: CharacterSkillStyleInput[] = []
  const scores: CharacterScoreInput[] = []
  let failureReported!: () => void
  const reported = new Promise<void>((resolve) => {
    failureReported = resolve
  })
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(basicFields, skillStyle)),
    ...scoring(() => engineResult),
    recordCharacterBasic: async () => {
      throw new Error('database closed')
    },
    recordCharacterSkillStyle: async (style) => {
      styles.push(style)
    },
    recordCharacterScore: async (score) => {
      scores.push(score)
    },
    writeAccessLog: (line) => {
      if (JSON.parse(line).code !== undefined) {
        failureReported()
      }
    }
  })
  t.after(() => app.close())

  const { body } = await getDetails(origin)
  await reported

  assert.equal(body.card.score.value, engineResult.score)
  assert.deepEqual(styles, [])
  assert.deepEqual(scores, [])
})

test('상세 조회는 기본 정보를 저장한 뒤 계산한 점수를 종류, 계산 시각, 엔진 버전과 함께 저장하고, 저장해 둔 응답을 다시 쓰면 저장하지 않는다', {
  timeout: 10_000
}, async (t) => {
  let savedBasics = 0
  const savedBasicsBeforeScore: number[] = []
  const scores: CharacterScoreInput[] = []
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(basicFields)),
    ...scoring(() => engineResult),
    recordCharacterBasic: async () => {
      // 기본 정보보다 먼저 저장하면 characters 참조가 깨지므로, 늦게 끝나도 기다리는지 보려고 일부러 늦춘다.
      await new Promise((resolve) => setTimeout(resolve, 20))
      savedBasics++
    },
    recordCharacterScore: async (score) => {
      savedBasicsBeforeScore.push(savedBasics)
      scores.push(score)
    }
  })
  t.after(() => app.close())

  const before = Date.now()
  const first = await getDetails(origin)
  const after = Date.now()
  const cached = await getDetails(origin)
  await waitUntil(() => savedBasics === 2)

  assert.deepEqual(first.body.card, cached.body.card)
  assert.deepEqual(savedBasicsBeforeScore, [1])
  const [score] = scores
  assert.ok(score.calculatedAt.getTime() >= before && score.calculatedAt.getTime() <= after)
  assert.deepEqual(
    { ...score, calculatedAt: undefined },
    {
      ...character,
      kind: 'equipment',
      score: 1741,
      calculatedAt: undefined,
      engine: { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }
    }
  )
})

test('점수를 내지 못한 결과는 저장하지 않는다', { timeout: 10_000 }, async (t) => {
  const scores: CharacterScoreInput[] = []
  let savedBasic!: () => void
  const basicSaved = new Promise<void>((resolve) => {
    savedBasic = resolve
  })
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(basicFields)),
    ...scoring(() => ({
      ...engineResult,
      score: null,
      skipped: { kind: 'resolution', message: '판정 불가' },
      approximate_score: 1650,
      approximate_source: 'legacy_fusion_policy_a',
      warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
    })),
    recordCharacterBasic: async () => {
      savedBasic()
    },
    recordCharacterScore: async (score) => {
      scores.push(score)
    }
  })
  t.after(() => app.close())

  const { body } = await getDetails(origin)
  await basicSaved
  // 점수 저장은 기본 정보 저장 다음 차례에 시작하므로, 그 차례가 지나도록 한 번 넘긴다.
  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(body.card.score.approximate.value, 1650)
  assert.deepEqual(scores, [])
})

test('점수 저장이 실패해도 상세 응답은 그대로이고 실패 code를 남긴다', {
  timeout: 10_000
}, async (t) => {
  const codes: string[] = []
  let failureReported!: () => void
  const reported = new Promise<void>((resolve) => {
    failureReported = resolve
  })
  const failing = await listen({
    details: detailsReturning(payloadsWith(basicFields)),
    ...scoring(() => engineResult),
    recordCharacterBasic: async () => undefined,
    recordCharacterScore: async () => {
      throw new Error('database closed')
    },
    writeAccessLog: (line) => {
      const { code } = JSON.parse(line)
      if (code !== undefined) {
        codes.push(code)
        failureReported()
      }
    }
  })
  t.after(() => failing.app.close())
  const withoutDatabase = await listen({
    details: detailsReturning(payloadsWith(basicFields)),
    ...scoring(() => engineResult)
  })
  t.after(() => withoutDatabase.app.close())

  const response = await getDetails(failing.origin)
  const expected = await getDetails(withoutDatabase.origin)
  await reported

  assert.equal(response.status, 200)
  assert.deepEqual(withoutFetchTimes(response.body), withoutFetchTimes(expected.body))
  assert.deepEqual(codes, ['CHARACTER_SCORE_RECORD_FAILED'])
})

test('타임라인 동기화 요청이 예외를 던져도 상세 응답은 그대로이고 기본 정보를 저장한다', async (t) => {
  const payloads = payloadsWith(basicFields)
  const recorded: CharacterBasicInput[] = []
  let backfillRequests = 0
  const throwing = await listen({
    details: detailsReturning(payloads),
    timeline: {
      // queue가 일을 시작하는 자리에서 던져, 동기화를 요청한 구독 함수까지 예외가 올라간다.
      sync: () => {
        throw new Error('synthetic subscriber failure')
      },
      backfillEnhancements: async () => {
        backfillRequests++
      },
      backfillSeason: async () => assert.fail('옛 시즌 받기를 부르면 안 된다'),
      read: async () => assert.fail('타임라인을 읽으면 안 된다'),
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      close: async () => undefined
    },
    recordCharacterBasic: async (basic) => {
      recorded.push(basic)
    }
  })
  t.after(() => throwing.app.close())
  const withoutDatabase = await listen({ details: detailsReturning(payloads) })
  t.after(() => withoutDatabase.app.close())

  const response = await getDetails(throwing.origin)
  const expected = await getDetails(withoutDatabase.origin)

  // 타임라인 구독 함수는 동기화 다음에 백필을 요청하므로, 백필 요청이 없어야 예외가 구독 함수 밖으로 나온 것이다.
  assert.equal(backfillRequests, 0)
  assert.equal(response.status, 200)
  assert.deepEqual(withoutFetchTimes(response.body), withoutFetchTimes(expected.body))
  assert.deepEqual(recorded, [basicFields])
})

for (const [name, database, connected] of [
  [
    'DB 설정이 없으면 공개 app에 타임라인 queue가 없고 기본 정보 기록 option도 없다',
    undefined,
    false
  ],
  [
    'DB 설정이 있으면 공개 app에 타임라인 queue가 있고 기본 정보 기록 option도 있다',
    // 합성 값이며 실제 credential이 아니다. 연결은 첫 query 때 하므로 이 테스트는 DB에 연결하지 않는다.
    {
      host: '127.0.0.1',
      port: 5432,
      database: 'dfragon',
      username: 'synthetic',
      password: 'synthetic'
    },
    true
  ]
] as const) {
  test(name, async (t) => {
    const options = createApiRuntimeOptions({
      port: 0,
      localHttps: undefined,
      apiKey: 'synthetic-neople-key',
      database,
      scoreLibraryPath: null
    })
    const { app, readQueueCounts } = await createApiHttpApp(options)
    t.after(() => app.close())

    // 상세 조회가 타임라인 동기화를 요청할 queue는 DB 설정을 준 app에만 있고, 없는 app에서 세면 던진다.
    const queueNames = (() => {
      try {
        return readQueueCounts().map(({ name }) => name)
      } catch {
        return []
      }
    })()

    const expectedQueueNames = connected
      ? ['timeline-sync', 'enhancement-backfill', 'season-backfill']
      : []
    assert.deepEqual(queueNames, expectedQueueNames)
    assert.equal(options.recordCharacterBasic !== undefined, connected)
  })
}
