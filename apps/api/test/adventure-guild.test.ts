import assert from 'node:assert/strict'
import test from 'node:test'
import type { StoredCharacter } from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import type { AdventureGuildReader } from '../src/adventure-guild/service.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'

// 합성 캐릭터다. DB 읽기는 fake이며 정렬과 저장은 container-adventure-guild-check.mjs가 실제 DB로 확인한다.
const fetchedAt = new Date('2026-11-06T00:00:00.000Z')
function member(characterId: string, fame: number | null): StoredCharacter {
  return {
    serverId: 'cain',
    characterId,
    characterName: `합성${characterId}`,
    adventureName: '합성모험단',
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame,
    guildId: 'synthetic-guild',
    guildName: '합성길드',
    fetchedAt
  }
}

async function listen(
  adventureGuild?: AdventureGuildReader
): Promise<{ app: INestApplication; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    adventureGuild,
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

async function getJson(origin: string, path: string, method = 'GET') {
  const response = await fetch(new URL(path, origin), { method })
  const body = method === 'HEAD' ? null : await response.json()

  return { status: response.status, body }
}

test('모험단 조회는 인코딩한 이름을 풀어 읽고 그 이름과 캐릭터 행을 준다', async () => {
  const names: string[] = []
  const characters = [member('a', 70000), member('b', null)]
  const { app, origin } = await listen({
    readAdventureCharacters: async (adventureName) => {
      names.push(adventureName)

      return characters
    },
    readGuild: async () => assert.fail('길드를 읽으면 안 된다')
  })
  try {
    const answer = await getJson(
      origin,
      `/adventures/${encodeURIComponent('합성 모험단/1')}/characters`
    )

    assert.equal(answer.status, 200)
    assert.deepEqual(names, ['합성 모험단/1'])
    assert.deepEqual(answer.body, {
      adventureName: '합성 모험단/1',
      characters: characters.map((character) => ({
        ...character,
        fetchedAt: '2026-11-06T00:00:00.000Z'
      }))
    })
  } finally {
    await app.close()
  }
})

test('길드 조회는 명성이 있는 길드원만으로 평균 명성을 반올림한다', async () => {
  const members = [member('a', 70001), member('b', 70000), member('c', null)]
  const { app, origin } = await listen({
    readAdventureCharacters: async () => assert.fail('모험단을 읽으면 안 된다'),
    readGuild: async (guildId) => {
      assert.equal(guildId, 'synthetic-guild')

      return { guildName: '합성길드', members }
    }
  })
  try {
    const { status, body } = await getJson(origin, '/guilds/synthetic-guild')

    assert.equal(status, 200)
    assert.equal(body.guildId, 'synthetic-guild')
    assert.equal(body.guildName, '합성길드')
    assert.equal(body.memberCount, 3)
    assert.equal(body.averageFame, 70001)
    assert.deepEqual(
      body.members.map(({ characterId }: StoredCharacter) => characterId),
      ['a', 'b', 'c']
    )
  } finally {
    await app.close()
  }
})

test('명성이 있는 길드원이 없으면 평균 명성은 null이다', async () => {
  const { app, origin } = await listen({
    readAdventureCharacters: async () => [],
    readGuild: async () => ({ guildName: '합성길드', members: [member('a', null)] })
  })
  try {
    const { body } = await getJson(origin, '/guilds/synthetic-guild')

    assert.equal(body.memberCount, 1)
    assert.equal(body.averageFame, null)
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 두 경로에 빈 목록을 준다', async () => {
  const { app, origin } = await listen()
  try {
    assert.deepEqual(await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/characters'), {
      status: 200,
      body: { adventureName: '합성', characters: [] }
    })
    assert.deepEqual(await getJson(origin, '/guilds/synthetic-guild'), {
      status: 200,
      body: {
        guildId: 'synthetic-guild',
        guildName: null,
        memberCount: 0,
        averageFame: null,
        members: []
      }
    })
  } finally {
    await app.close()
  }
})

test('두 경로는 query와 HEAD를 거절하고 DB를 읽지 않는다', async () => {
  const { app, origin } = await listen({
    readAdventureCharacters: async () => assert.fail('모험단을 읽으면 안 된다'),
    readGuild: async () => assert.fail('길드를 읽으면 안 된다')
  })
  try {
    for (const path of ['/adventures/합성/characters', '/guilds/synthetic-guild']) {
      const query = await getJson(origin, `${path}?serverId=cain`)
      assert.equal(query.status, 400, path)
      assert.equal(query.body.error.code, 'INVALID_CHARACTER_QUERY', path)
      assert.equal((await getJson(origin, path, 'HEAD')).status, 400, path)
    }
  } finally {
    await app.close()
  }
})

test('DB 읽기가 실패하면 500 INTERNAL_SERVER_ERROR를 준다', async () => {
  const { app, origin } = await listen({
    readAdventureCharacters: async () => {
      throw new Error('synthetic database failure')
    },
    readGuild: async () => {
      throw new Error('synthetic database failure')
    }
  })
  try {
    for (const path of ['/adventures/합성/characters', '/guilds/synthetic-guild']) {
      const { status, body } = await getJson(origin, path)
      assert.equal(status, 500, path)
      assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR', path)
    }
  } finally {
    await app.close()
  }
})
