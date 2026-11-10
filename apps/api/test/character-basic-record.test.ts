import assert from 'node:assert/strict'
import test from 'node:test'
import {
  type CharacterBasicInput,
  type CharacterSkillStyleInput,
  type DatabaseClient,
  recordCharacter,
  recordCharacterBasic
} from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import { CharacterBasicSubscriber } from '../src/characters/basic/subscriber.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import type { CharacterPayload, CharacterPayloads } from '../src/characters/details/sections.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/http.js'
import { createApiRuntime } from '../src/runtime/application.js'

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
    'details' | 'recordCharacterBasic' | 'recordCharacterSkillStyle' | 'writeAccessLog'
  >
): Promise<{ app: INestApplication; origin: string }> {
  const app = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined,
    ...options
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

function detailsReturning(payloads: CharacterPayloads): ApiHttpAppOptions['details'] {
  return {
    fetchDetails: async () => payloads,
    catalog: createCatalogService(async () => new Map())
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
      catalog: createCatalogService(async () => new Map())
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

  // 받은 시각은 두 앱이 다르므로 그 시각이 들어간 필드는 비교하지 않는다.
  const { sections: _sections, freshness: _freshness, ...content } = response.body
  const {
    sections: _expectedSections,
    freshness: _expectedFreshness,
    ...expectedContent
  } = expected.body
  assert.equal(response.status, 200)
  assert.deepEqual(content, expectedContent)
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
      catalog: createCatalogService(async () => new Map())
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

test('기본 정보를 저장하지 못하면 스킬 스타일도 저장하지 않는다', {
  timeout: 10_000
}, async (t) => {
  const styles: CharacterSkillStyleInput[] = []
  let failureReported!: () => void
  const reported = new Promise<void>((resolve) => {
    failureReported = resolve
  })
  const { app, origin } = await listen({
    details: detailsReturning(payloadsWith(basicFields, skillStyle)),
    recordCharacterBasic: async () => {
      throw new Error('database closed')
    },
    recordCharacterSkillStyle: async (style) => {
      styles.push(style)
    },
    writeAccessLog: (line) => {
      if (JSON.parse(line).code !== undefined) {
        failureReported()
      }
    }
  })
  t.after(() => app.close())

  await getDetails(origin)
  await reported

  assert.deepEqual(styles, [])
})

for (const [name, database, registered] of [
  ['DB 설정이 없으면 기본 정보 구독자를 등록하지 않는다', undefined, false],
  [
    'DB 설정이 있으면 기본 정보 구독자를 등록한다',
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
    const app = await createApiRuntime({
      port: 0,
      trustedProxyHops: undefined,
      localHttps: undefined,
      apiKey: 'synthetic-neople-key',
      database,
      ops: undefined,
      scoreLibraryPath: null
    })
    t.after(() => app.close())

    const found = (() => {
      try {
        app.get(CharacterBasicSubscriber)

        return true
      } catch {
        return false
      }
    })()

    assert.equal(found, registered)
  })
}
