import assert from 'node:assert/strict'
import test from 'node:test'
import type { CharacterBasicInput } from '@dfragon/database'
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

function payloadsWith(basic: CharacterPayload): CharacterPayloads {
  return {
    basic,
    status: { ...basic, status: [], buff: [] },
    equipment: { ...basic, equipment: [], setItemInfo: [] },
    avatar: { ...basic, avatar: [] },
    creature: { ...basic, creature: null },
    oath: { ...basic, oath: null },
    mist_assimilation: { ...basic, mistAssimilation: null },
    skill_style: { ...basic, skill: { style: { active: [] } } },
    buff_equipment: { ...basic, skill: { buff: null } },
    buff_avatar: { ...basic, skill: { buff: null } },
    buff_creature: { ...basic, skill: { buff: null } }
  }
}

async function listen(
  options: Pick<ApiHttpAppOptions, 'details' | 'recordCharacterBasic' | 'writeAccessLog'>
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
      webDevOrigins: [],
      apiKey: 'synthetic-neople-key',
      database,
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
