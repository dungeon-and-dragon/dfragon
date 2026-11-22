import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type {
  CharacterTimelineEventRow,
  StoredCharacter,
  StoredCharacterScore,
  TimelineCharacter
} from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import type { AdventureGuildRepository } from '../src/application/adventure-guild/repository.js'
import type { CharacterRow, CharacterRowScore } from '../src/domain/character-row.js'
import { parseAdventureWeeklyClears as toAdventureWeeklyClears } from '../src/infrastructure/database/adventure-weekly.js'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

// 합성 캐릭터다. DB 읽기는 fake이며 정렬, 저장과 주간 경계는 container-adventure-guild-check.mjs가 실제 DB로 확인한다.
const fetchedAt = new Date('2026-11-06T00:00:00.000Z')
function member(
  characterId: string,
  fame: number | null,
  score: StoredCharacterScore | null = null
): StoredCharacter {
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
    fetchedAt,
    dealerSkillLearned: null,
    score
  }
}

function memberRow(
  characterId: string,
  fame: number | null,
  score: CharacterRowScore | null
): CharacterRow {
  const { dealerSkillLearned, score: _stored, ...row } = member(characterId, fame)

  return { ...row, role: 'dealer', score }
}

async function listen(
  adventureGuild?: AdventureGuildRepository,
  syncTimeline?: (character: TimelineCharacter) => Promise<void>
): Promise<{ app: HttpAppHandle; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
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

test('모험단 조회는 인코딩한 이름을 풀어 읽고 그 이름과 근사 여부를 포함한 저장된 점수가 붙은 캐릭터 행을 준다', async () => {
  const names: string[] = []
  const characters = [
    member('a', 70000, { kind: 'equipment', value: 1234567, approximateSource: null }),
    member('b', null),
    member('c', 69000, { kind: 'buff', value: 4000000, approximateSource: 'synthetic-source' })
  ]
  const { app, origin } = await listen({
    readAdventureCharacters: async (adventureName) => {
      names.push(adventureName)

      return characters
    },
    readGuild: async () => assert.fail('길드를 읽으면 안 된다'),
    readAdventureWeeklyClears: async () => assert.fail('주간 클리어를 읽으면 안 된다'),
    readAdventureEquipment: async () => assert.fail('모험단 장비를 읽으면 안 된다'),
    readAdventureTimeline: async () => assert.fail('모험단 타임라인을 읽으면 안 된다'),
    readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
    readAdventureSeasonDays: async () => assert.fail('시즌 하루 활동을 읽으면 안 된다'),
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
      characters: [
        memberRow('a', 70000, { calculator: 'equipment', value: 1234567, approximate: null }),
        memberRow('b', null, null),
        memberRow('c', 69000, {
          calculator: 'buff',
          value: 4000000,
          approximate: { source: 'synthetic-source' }
        })
      ].map((character) => ({
        ...character,
        fetchedAt: '2026-11-06T00:00:00.000Z'
      }))
    })
  } finally {
    await app.close()
  }
})

test('길드 조회는 평균 명성 없이 길드 이름, 길드원 수, 저장된 점수가 붙은 길드원 목록을 준다', async () => {
  const members = [
    member('a', 70001),
    member('b', 70000, { kind: 'buff', value: 4321000, approximateSource: null }),
    member('c', null)
  ]
  const { app, origin } = await listen({
    readAdventureCharacters: async () => assert.fail('모험단을 읽으면 안 된다'),
    readGuild: async (guildId) => {
      assert.equal(guildId, 'synthetic-guild')

      return { guildName: '합성길드', members }
    },
    readAdventureWeeklyClears: async () => assert.fail('주간 클리어를 읽으면 안 된다'),
    readAdventureEquipment: async () => assert.fail('모험단 장비를 읽으면 안 된다'),
    readAdventureTimeline: async () => assert.fail('모험단 타임라인을 읽으면 안 된다'),
    readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
    readAdventureSeasonDays: async () => assert.fail('시즌 하루 활동을 읽으면 안 된다'),
    readAdventureSeasonBackfill: async () => assert.fail('옛 시즌 받기를 읽으면 안 된다')
  })
  try {
    const { status, body } = await getJson(origin, '/guilds/synthetic-guild')

    assert.equal(status, 200)
    assert.equal(Object.hasOwn(body, 'averageFame'), false)
    assert.equal(body.guildId, 'synthetic-guild')
    assert.equal(body.guildName, '합성길드')
    assert.equal(body.memberCount, 3)
    assert.deepEqual(
      body.members.map(({ characterId, score }: CharacterRow) => [characterId, score]),
      [
        ['a', null],
        ['b', { calculator: 'buff', value: 4321000, approximate: null }],
        ['c', null]
      ]
    )
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 모험단 캐릭터, 길드, 주간, 장비, 시즌 활동 조회에 빈 목록을 준다', async () => {
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
        members: []
      }
    })
    assert.deepEqual(await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/weekly'), {
      status: 200,
      body: { adventureName: '합성', clearNames: [], characters: [] }
    })
    assert.deepEqual(await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/equipment'), {
      status: 200,
      body: { adventureName: '합성', sets: [], servers: [], selected: null }
    })
    assert.deepEqual(await getJson(origin, '/adventures/%ED%95%A9%EC%84%B1/timeline'), {
      status: 200,
      body: { items: [], nextCursor: null }
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
      oaths: { legendary: 0, epic: 0, primeval: 0 },
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
    readAdventureEquipment: async () => {
      throw new Error('synthetic database failure')
    },
    readAdventureTimeline: async () => {
      throw new Error('synthetic database failure')
    },
    readAdventureActivity: async () => {
      throw new Error('synthetic database failure')
    },
    readAdventureSeasonDays: async () => assert.fail('시즌 하루 활동을 읽으면 안 된다'),
    readAdventureSeasonBackfill: async () => {
      throw new Error('synthetic database failure')
    }
  })
  try {
    for (const path of [
      '/adventures/합성/characters',
      '/guilds/synthetic-guild',
      '/adventures/합성/weekly',
      '/adventures/합성/equipment',
      '/adventures/합성/timeline',
      '/adventures/합성/activity'
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

const syntheticEquipmentSet = { id: 'synthetic-set', name: '합성 세트' }
const syntheticOathSet = { id: 16204, name: '합성 서약', option: '합성 선택지' }

test('주간 클리어는 고정한 레이드, 레기온 열에 목요일 06:00부터의 클리어만 표시한다', () => {
  const noSets = { equipmentSet: null, oathSet: null }
  const weekly = toAdventureWeeklyClears(
    [
      { ...member('a', 70000), equipmentSet: syntheticEquipmentSet, oathSet: syntheticOathSet },
      { ...member('b', 60000), ...noSets },
      { ...member('none', null), ...noSets }
    ],
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
  assert.deepEqual(weekly.characters.at(0), {
    ...memberRow('a', 70000, null),
    equipmentSet: syntheticEquipmentSet,
    oathSet: syntheticOathSet,
    weeklyClears: [
      { kind: 'raid', name: '디레지에 레이드' },
      { kind: 'legion', name: '아포칼립스' }
    ]
  })
  assert.deepEqual(weekly.characters.at(-1), {
    ...memberRow('none', null, null),
    equipmentSet: null,
    oathSet: null,
    weeklyClears: []
  })
})

test('주간 클리어 조회는 캐릭터마다 동기화를 요청하고 끝나기를 기다리지 않는다', async () => {
  const requested: TimelineCharacter[] = []
  let release!: () => void
  const syncing = new Promise<void>((resolve) => {
    release = resolve
  })
  const characters = [memberRow('a', 70000, null), memberRow('b', null, null)].map((character) => ({
    ...character,
    equipmentSet: null,
    oathSet: null,
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
      readAdventureEquipment: async () => assert.fail('모험단 장비를 읽으면 안 된다'),
      readAdventureTimeline: async () => assert.fail('모험단 타임라인을 읽으면 안 된다'),
      readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
      readAdventureSeasonDays: async () => assert.fail('시즌 하루 활동을 읽으면 안 된다'),
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

test('모험단 장비 조회는 고른 서버, 세트의 보유만 주고, 모든 서버의 캐릭터마다 동기화를 요청하고 끝나기를 기다리지 않는다', async () => {
  const requested: TimelineCharacter[] = []
  let release!: () => void
  const syncing = new Promise<void>((resolve) => {
    release = resolve
  })
  const holding = {
    setItemId: 'v'.repeat(32),
    slot: '상의',
    rarity: '에픽',
    itemId: 'a'.repeat(32),
    itemName: '합성 상의',
    count: 1
  }
  const otherSet = { ...holding, setItemId: 'w'.repeat(32), slot: '하의' }
  const cain = { ...memberRow('a', 70000, null), equipment: [holding, otherSet], oaths: [] }
  const siroco = { ...memberRow('b', 60000, null), serverId: 'siroco' }
  const sets = [
    { setItemId: 'v'.repeat(32), setItemName: '합성 세트' },
    { setItemId: 'w'.repeat(32), setItemName: '합성 다른 세트' }
  ]
  const equipment = {
    sets,
    servers: [
      { serverId: 'cain', characters: [cain] },
      { serverId: 'siroco', characters: [{ ...siroco, equipment: [], oaths: [] }] }
    ]
  }
  const { app, origin } = await listen(
    {
      readAdventureCharacters: async () => assert.fail('모험단만 읽으면 안 된다'),
      readGuild: async () => assert.fail('길드를 읽으면 안 된다'),
      readAdventureWeeklyClears: async () => assert.fail('주간 클리어를 읽으면 안 된다'),
      readAdventureTimeline: async () => assert.fail('모험단 타임라인을 읽으면 안 된다'),
      readAdventureEquipment: async (adventureName) => {
        assert.equal(adventureName, '합성 모험단')

        return equipment
      },
      readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다'),
      readAdventureSeasonDays: async () => assert.fail('시즌 하루 활동을 읽으면 안 된다'),
      readAdventureSeasonBackfill: async () => assert.fail('옛 시즌 받기를 읽으면 안 된다')
    },
    (character) => {
      requested.push(character)

      return syncing
    }
  )

  try {
    const path = `/adventures/${encodeURIComponent('합성 모험단')}/equipment`
    const { status, body } = await getJson(origin, `${path}?server=cain&set=${'w'.repeat(32)}`)
    const expected = JSON.parse(
      JSON.stringify({
        adventureName: '합성 모험단',
        sets,
        servers: [
          { serverId: 'cain', characters: [{ ...cain, equipment: [otherSet] }] },
          { serverId: 'siroco', characters: [] }
        ],
        selected: { serverId: 'cain', setItemId: 'w'.repeat(32) }
      })
    )

    assert.equal(status, 200)
    assert.deepEqual(body, expected)
    assert.equal((await getJson(origin, `${path}?set=a&set=b`)).status, 400)
    release()

    while (requested.length < 2) {
      await nextTurn()
    }

    assert.deepEqual(requested, [
      { serverId: 'cain', characterId: 'a' },
      { serverId: 'siroco', characterId: 'b' }
    ])
  } finally {
    release()
    await app.close()
  }
})
