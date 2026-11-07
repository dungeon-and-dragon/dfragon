import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type {
  CharacterTimelineEventRow,
  StoredCharacter,
  TimelineCharacter
} from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import type { AdventureGuildReader } from '../src/adventure-guild/service.js'
import { toAdventureWeeklyClears } from '../src/adventure-guild/weekly.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'

// 합성 캐릭터다. DB 읽기는 fake이며 정렬, 저장과 주간 경계는 container-adventure-guild-check.mjs가 실제 DB로 확인한다.
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
  adventureGuild?: AdventureGuildReader,
  syncTimeline?: (character: TimelineCharacter) => Promise<void>
): Promise<{ app: INestApplication; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    adventureGuild,
    timeline: syncTimeline && {
      sync: syncTimeline,
      read: unused,
      readPage: unused,
      backfillEnhancements: unused,
      backfillSeason: unused,
      close: async () => undefined
    },
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

async function getJson(origin: string, path: string) {
  const response = await fetch(new URL(path, origin))
  const body = await response.json()

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
    readGuild: async () => assert.fail('길드를 읽으면 안 된다'),
    readAdventureWeeklyClears: async () => assert.fail('주간 클리어를 읽으면 안 된다'),
    readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
    readAdventureActivityDay: async () => assert.fail('하루 활동을 읽으면 안 된다'),
    readAdventureSeasonBackfill: async () => assert.fail('옛 시즌 받기를 읽으면 안 된다')
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
    },
    readAdventureWeeklyClears: async () => assert.fail('주간 클리어를 읽으면 안 된다'),
    readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
    readAdventureActivityDay: async () => assert.fail('하루 활동을 읽으면 안 된다'),
    readAdventureSeasonBackfill: async () => assert.fail('옛 시즌 받기를 읽으면 안 된다')
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
    readGuild: async () => ({ guildName: '합성길드', members: [member('a', null)] }),
    readAdventureWeeklyClears: async () => assert.fail('주간 클리어를 읽으면 안 된다'),
    readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
    readAdventureActivityDay: async () => assert.fail('하루 활동을 읽으면 안 된다'),
    readAdventureSeasonBackfill: async () => assert.fail('옛 시즌 받기를 읽으면 안 된다')
  })
  try {
    const { body } = await getJson(origin, '/guilds/synthetic-guild')

    assert.equal(body.memberCount, 1)
    assert.equal(body.averageFame, null)
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 다섯 경로에 빈 목록을 준다', async () => {
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
    assert.deepEqual(await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/weekly'), {
      status: 200,
      body: { adventureName: '합성', clearNames: [], characters: [] }
    })
    const activity = await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/activity')
    assert.equal(activity.status, 200)
    assert.deepEqual(activity.body.seasons, [])
    assert.equal(activity.body.season, null)
    assert.deepEqual(activity.body.days, [])
    assert.deepEqual(activity.body.summary, {
      raids: [],
      legions: [],
      items: { legendary: 0, epic: 0, primeval: 0, mythic: 0 },
      enhancement: {
        attempts: 0,
        amplify: [],
        reinforce: [],
        amplifyBelow10: 0,
        reinforceBelow12: 0,
        refine: 0
      }
    })
    assert.equal(
      (await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/activity?season=11')).status,
      400
    )
    assert.deepEqual(
      await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/activity/days/2026-07-18'),
      {
        status: 200,
        body: { date: '2026-07-18', raids: [], legions: [], items: [], enhancements: [] }
      }
    )
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
    },
    readAdventureWeeklyClears: async () => {
      throw new Error('synthetic database failure')
    },
    readAdventureActivity: async () => {
      throw new Error('synthetic database failure')
    },
    readAdventureActivityDay: async () => {
      throw new Error('synthetic database failure')
    },
    readAdventureSeasonBackfill: async () => {
      throw new Error('synthetic database failure')
    }
  })
  try {
    for (const path of [
      '/adventures/합성/characters',
      '/guilds/synthetic-guild',
      '/adventures/합성/weekly',
      '/adventures/합성/activity',
      '/adventures/합성/activity/days/2026-07-18'
    ]) {
      const { status, body } = await getJson(origin, path)
      assert.equal(status, 500, path)
      assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR', path)
    }
    const backfill = await fetch(new URL('/adventures/합성/activity/seasons/9/backfill', origin), {
      method: 'POST'
    })
    assert.equal(backfill.status, 500)
    assert.equal((await backfill.json()).error.code, 'INTERNAL_SERVER_ERROR')
  } finally {
    await app.close()
  }
})

const weekStart = new Date('2026-11-05T06:00:00+09:00')
function clearEvent(
  characterId: string,
  occurredAt: string,
  row: Pick<CharacterTimelineEventRow, 'code' | 'raidName' | 'data'>
): CharacterTimelineEventRow {
  return { serverId: 'cain', characterId, occurredAt: new Date(occurredAt), name: '레이드', ...row }
}
const raid = (characterId: string, occurredAt: string, raidName: string) =>
  clearEvent(characterId, occurredAt, { code: 201, raidName, data: {} })
const legion = (characterId: string, occurredAt: string, regionName: string) =>
  clearEvent(characterId, occurredAt, { code: 209, raidName: null, data: { regionName } })

test('주간 클리어는 고정한 레이드, 레기온 열에 목요일 06:00부터의 클리어만 표시한다', () => {
  const weekly = toAdventureWeeklyClears(
    [member('a', 70000), member('b', 60000), member('none', null)],
    [
      raid('a', '2026-11-05T05:59:00+09:00', '무너진 성자 미카엘라'),
      legion('a', '2026-11-05T06:00:00+09:00', '아포칼립스'),
      raid('a', '2026-11-05T07:00:00+09:00', '디레지에 레이드'),
      raid('a', '2026-11-05T08:00:00+09:00', '디레지에 레이드'),
      raid('b', '2026-11-06T12:00:00+09:00', '나벨 레이드'),
      legion('b', '2026-11-06T12:30:00+09:00', '베누스'),
      raid('b', '2026-11-06T13:00:00+09:00', '무너진 성자 미카엘라'),
      clearEvent('b', '2026-11-06T14:00:00+09:00', { code: 209, raidName: null, data: {} })
    ],
    weekStart
  )

  assert.deepEqual(weekly.clearNames, [
    { kind: 'raid', name: '디레지에 레이드' },
    { kind: 'raid', name: '무너진 성자 미카엘라' },
    { kind: 'legion', name: '아포칼립스' }
  ])
  assert.deepEqual(
    weekly.characters.map(({ characterId, weeklyClears }) => [characterId, weeklyClears]),
    [
      [
        'a',
        [
          { kind: 'raid', name: '디레지에 레이드' },
          { kind: 'legion', name: '아포칼립스' }
        ]
      ],
      ['b', [{ kind: 'raid', name: '무너진 성자 미카엘라' }]],
      ['none', []]
    ]
  )
  assert.deepEqual(weekly.characters.at(-1), { ...member('none', null), weeklyClears: [] })
})

test('주간 클리어 조회는 캐릭터마다 동기화를 요청하고 끝나기를 기다리지 않는다', async () => {
  const requested: TimelineCharacter[] = []
  let release!: () => void
  const syncing = new Promise<void>((resolve) => {
    release = resolve
  })
  const characters = [member('a', 70000), member('b', null)].map((character) => ({
    ...character,
    weeklyClears: []
  }))
  const { app, origin } = await listen(
    {
      readAdventureCharacters: async () => assert.fail('모험단만 읽으면 안 된다'),
      readGuild: async () => assert.fail('길드를 읽으면 안 된다'),
      readAdventureWeeklyClears: async (adventureName) => {
        assert.equal(adventureName, '합성 모험단')

        return { clearNames: [{ kind: 'raid', name: '디레지에 레이드' }], characters }
      },
      readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
      readAdventureActivityDay: async () => assert.fail('하루 활동을 읽으면 안 된다'),
      readAdventureSeasonBackfill: async () => assert.fail('옛 시즌 받기를 읽으면 안 된다')
    },
    (character) => {
      requested.push(character)

      return syncing
    }
  )
  try {
    const { status, body } = await getJson(
      origin,
      `/adventures/${encodeURIComponent('합성 모험단')}/weekly`
    )

    assert.equal(status, 200)
    assert.equal(body.adventureName, '합성 모험단')
    assert.deepEqual(body.clearNames, [{ kind: 'raid', name: '디레지에 레이드' }])
    assert.deepEqual(
      body.characters.map(({ characterId }: StoredCharacter) => characterId),
      ['a', 'b']
    )
    release()
    while (requested.length < 2) {
      await nextTurn()
    }
    assert.deepEqual(requested, [
      { serverId: 'cain', characterId: 'a' },
      { serverId: 'cain', characterId: 'b' }
    ])
  } finally {
    release()
    await app.close()
  }
})
