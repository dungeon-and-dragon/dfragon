import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import {
  createDatabaseClient,
  readAdventureCharacters,
  readDatabaseConfiguration,
  readGuild,
  recordCharacter,
  recordCharacterBasic,
  replaceEnhancementBackfillRange,
  replaceTimelineRange
} from '@dfragon/database'
import { emptySeasonActivity, readAdventureActivity } from './dist/adventure-guild/activity.js'
import { readAdventureWeeklyClears } from './dist/adventure-guild/weekly.js'

// 합성 캐릭터다. 여러 서버에 걸친 모험단과 길드, 명성이 없는 캐릭터와 기본 정보가 없는 캐릭터를 둔다.
const job = {
  level: 115,
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터'
}
const basic = (serverId, characterId, adventureName, fame, guildId, guildName) => ({
  ...job,
  serverId,
  characterId,
  characterName: `합성${characterId}`,
  adventureName,
  fame,
  guildId,
  guildName
})
const adventureName = '합성다서버모험단'
const guildId = 'synthetic-guild'
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  for (const character of [
    basic('cain', 'adventure-low', adventureName, 50000, null, null),
    basic('siroco', 'adventure-high', adventureName, 70000, guildId, '합성길드'),
    basic('bakal', 'adventure-no-fame', adventureName, null, 'other-guild', '다른길드'),
    basic('hilder', 'guild-no-fame', '합성길드원모험단', null, guildId, '합성길드')
  ]) {
    await recordCharacterBasic(client, character)
  }
  await recordCharacter(client, {
    serverId: 'cain',
    characterId: 'adventure-no-basic',
    characterName: '합성기본없음',
    adventureName
  })
  // basic_fetched_at이 ms 단위라 이름을 바꾼 길드원이 확실히 가장 나중에 받은 행이 되게 한다.
  await setTimeout(5)
  await recordCharacterBasic(
    client,
    basic('cain', 'guild-renamed', '합성길드원모험단', 60001, guildId, '새합성길드')
  )

  const adventure = await readAdventureCharacters(client, adventureName)
  assert.deepEqual(
    adventure.map(({ serverId, characterId, fame }) => `${serverId}/${characterId}:${fame}`),
    [
      'siroco/adventure-high:70000',
      'cain/adventure-low:50000',
      'bakal/adventure-no-fame:null',
      'cain/adventure-no-basic:null'
    ]
  )
  const [high] = adventure
  assert.ok(high.fetchedAt instanceof Date)
  assert.deepEqual(
    { ...high, fetchedAt: undefined },
    {
      ...basic('siroco', 'adventure-high', adventureName, 70000, guildId, '합성길드'),
      fetchedAt: undefined
    }
  )
  assert.deepEqual(adventure.at(-1), {
    serverId: 'cain',
    characterId: 'adventure-no-basic',
    characterName: '합성기본없음',
    adventureName,
    level: null,
    jobId: null,
    jobGrowId: null,
    jobName: null,
    jobGrowName: null,
    fame: null,
    guildId: null,
    guildName: null,
    fetchedAt: null
  })

  const guild = await readGuild(client, guildId)
  assert.equal(guild.guildName, '새합성길드')
  assert.deepEqual(
    guild.members.map(({ serverId, characterId }) => `${serverId}/${characterId}`),
    ['siroco/adventure-high', 'cain/guild-renamed', 'hilder/guild-no-fame']
  )

  assert.deepEqual(await readAdventureCharacters(client, '없는모험단'), [])
  assert.deepEqual(await readGuild(client, 'missing-guild'), { guildName: null, members: [] })

  // 합성 클리어다. 천해천 둘째 주 목요일 정오에 읽어 이번 주는 04-02 06:00부터다.
  const now = new Date('2026-04-02T12:00:00+09:00')
  const at = (time) => new Date(`2026-${time}+09:00`)
  const range = { start: at('03-01T00:00:00'), end: now }
  const raid = (code, time, raidName) => ({
    code,
    occurredAt: at(time),
    name: '레이드',
    raidName,
    data: {}
  })
  const legion = (time, regionName) => ({
    code: 209,
    occurredAt: at(time),
    name: '레기온',
    raidName: null,
    data: { regionName }
  })
  const item = (code, occurredAt, itemRarity, data = {}) => ({
    code,
    occurredAt,
    name: '합성',
    itemId: null,
    itemName: null,
    itemRarity,
    data
  })
  const clears = [
    [
      { serverId: 'siroco', characterId: 'adventure-high' },
      [
        raid(201, '04-02T05:59:00', '무너진 성자 미카엘라'),
        raid(210, '04-02T06:00:00', '디레지에 레이드'),
        raid(201, '04-02T06:30:00', '합성 목록 밖 레이드')
      ],
      [
        item(505, at('04-02T10:00:00'), '태초'),
        item(402, at('04-02T11:00:00'), '에픽', {
          before: 0,
          after: 12,
          result: false,
          safe: false
        })
      ]
    ],
    [
      { serverId: 'cain', characterId: 'adventure-low' },
      [legion('04-02T07:00:00', '아포칼립스')],
      []
    ],
    [
      { serverId: 'hilder', characterId: 'guild-no-fame' },
      [raid(201, '04-02T08:00:00', '무너진 성자 미카엘라')],
      [item(505, at('04-02T09:00:00'), '신화')]
    ]
  ]
  for (const [character, events, items] of clears) {
    await replaceTimelineRange(client, character, range, events, items)
  }
  // 중천 전 시즌에는 강화 백필 행만 들어온다. 선계 기간에 하나 넣어 집계하지 않는지 본다.
  await replaceEnhancementBackfillRange(
    client,
    { serverId: 'siroco', characterId: 'adventure-high' },
    { start: new Date('2024-01-01T00:00:00+09:00'), end: new Date('2024-01-31T00:00:00+09:00') },
    [401, 402, 403],
    [
      item(401, new Date('2024-01-10T12:00:00+09:00'), '에픽', {
        before: 11,
        after: 12,
        result: true,
        safe: false
      })
    ]
  )

  const weekly = await readAdventureWeeklyClears(client, adventureName, now)
  const fixedClearNames = [
    { kind: 'raid', name: '디레지에 레이드' },
    { kind: 'raid', name: '무너진 성자 미카엘라' },
    { kind: 'legion', name: '아포칼립스' }
  ]
  assert.deepEqual(weekly.clearNames, fixedClearNames)
  assert.deepEqual(
    weekly.characters.map(({ characterId, weeklyClears }) => [characterId, weeklyClears]),
    [
      ['adventure-high', [{ kind: 'raid', name: '디레지에 레이드' }]],
      ['adventure-low', [{ kind: 'legion', name: '아포칼립스' }]],
      ['adventure-no-fame', []],
      ['adventure-no-basic', []]
    ]
  )
  assert.deepEqual(weekly.characters.at(-1), { ...adventure.at(-1), weeklyClears: [] })
  assert.deepEqual(await readAdventureWeeklyClears(client, '없는모험단', now), {
    clearNames: fixedClearNames,
    characters: []
  })

  const seasonIds = [5, 6, 7, 8, 9, 10, 11]
  const activity = await readAdventureActivity(client, adventureName, undefined, now)
  assert.deepEqual(
    activity.characters.map(({ characterId }) => characterId),
    adventure.map(({ characterId }) => characterId)
  )
  assert.deepEqual(
    activity.activity.seasons.map(({ id, available }) => [id, available]),
    seasonIds.map((id) => [id, id >= 10])
  )
  const seasonActivity = {
    summary: {
      raids: [
        { name: '디레지에 레이드', count: 1 },
        { name: '무너진 성자 미카엘라', count: 1 },
        { name: '합성 목록 밖 레이드', count: 1 }
      ],
      legions: [{ name: '아포칼립스', count: 1 }],
      items: { legendary: 0, epic: 0, primeval: 1, mythic: 0 },
      enhancement: {
        ...emptySeasonActivity().summary.enhancement,
        attempts: 1,
        amplify: [{ target: 12, attempts: 1, successes: 0 }]
      }
    },
    days: [
      {
        date: '2026-04-01',
        raid: 1,
        legion: 0,
        item: 0,
        enhance: 0,
        primeval: false,
        mythic: false,
        highEnhancement: false
      },
      {
        date: '2026-04-02',
        raid: 2,
        legion: 1,
        item: 1,
        enhance: 1,
        primeval: true,
        mythic: false,
        highEnhancement: true
      }
    ]
  }
  assert.deepEqual(activity.activity, {
    seasons: activity.activity.seasons,
    season: { id: 11, startsAt: new Date('2026-03-26T06:00:00+09:00'), endsAt: null },
    ...seasonActivity
  })
  const emptyActivity = async (name, seasonId) => {
    const read = await readAdventureActivity(client, name, seasonId, now)

    return {
      season: read.activity.season,
      summary: read.activity.summary,
      days: read.activity.days
    }
  }
  assert.deepEqual(await emptyActivity('없는모험단', undefined), {
    season: activity.activity.season,
    ...emptySeasonActivity()
  })
  assert.deepEqual(await emptyActivity(adventureName, 10), {
    season: {
      id: 10,
      startsAt: new Date('2025-01-09T06:00:00+09:00'),
      endsAt: new Date('2026-03-26T06:00:00+09:00')
    },
    ...emptySeasonActivity()
  })
  assert.deepEqual(await emptyActivity(adventureName, 9), {
    season: {
      id: 9,
      startsAt: new Date('2023-09-14T06:00:00+09:00'),
      endsAt: new Date('2025-01-09T06:00:00+09:00')
    },
    ...emptySeasonActivity()
  })
  assert.equal(await readAdventureActivity(client, adventureName, 12, now), undefined)

  // 같은 컨테이너에서 DB 설정으로 뜬 API를 불러 runtime 연결까지 확인한다.
  const get = async (path) => {
    const response = await fetch(new URL(path, 'http://127.0.0.1:3000'))
    assert.equal(response.status, 200, path)

    return response.json()
  }
  const guildAnswer = await get(`/guilds/${guildId}`)
  assert.equal(guildAnswer.guildName, '새합성길드')
  assert.equal(guildAnswer.memberCount, 3)
  assert.equal(guildAnswer.averageFame, 65001)
  assert.deepEqual(
    guildAnswer.members.map(({ characterId }) => characterId),
    ['adventure-high', 'guild-renamed', 'guild-no-fame']
  )
  const adventureAnswer = await get(`/adventures/${encodeURIComponent(adventureName)}/characters`)
  assert.equal(adventureAnswer.adventureName, adventureName)
  assert.deepEqual(
    adventureAnswer.characters.map(({ characterId, fetchedAt }) => [
      characterId,
      fetchedAt === null
    ]),
    [
      ['adventure-high', false],
      ['adventure-low', false],
      ['adventure-no-fame', false],
      ['adventure-no-basic', true]
    ]
  )
  assert.deepEqual(await get(`/adventures/${encodeURIComponent('없는모험단')}/characters`), {
    adventureName: '없는모험단',
    characters: []
  })
  // 합성 클리어는 지금 시각의 이번 주보다 오래돼 비고, 동기화 요청은 internal network라 기록만 남기고 실패한다.
  const weeklyAnswer = await get(`/adventures/${encodeURIComponent(adventureName)}/weekly`)
  assert.equal(weeklyAnswer.adventureName, adventureName)
  assert.deepEqual(weeklyAnswer.clearNames, fixedClearNames)
  assert.deepEqual(
    weeklyAnswer.characters.map(({ characterId, weeklyClears }) => [characterId, weeklyClears]),
    [
      ['adventure-high', []],
      ['adventure-low', []],
      ['adventure-no-fame', []],
      ['adventure-no-basic', []]
    ]
  )
  // 지금 시각에 시즌이 더 생겨도 같은 값을 보도록 천해천을 골라 읽는다.
  const activityAnswer = await get(
    `/adventures/${encodeURIComponent(adventureName)}/activity?season=11`
  )
  assert.deepEqual(
    activityAnswer.seasons.slice(0, seasonIds.length).map(({ id }) => id),
    seasonIds
  )
  assert.deepEqual({ summary: activityAnswer.summary, days: activityAnswer.days }, seasonActivity)
  assert.deepEqual(await get('/guilds/missing-guild'), {
    guildId: 'missing-guild',
    guildName: null,
    memberCount: 0,
    averageFame: null,
    members: []
  })
} finally {
  await client.$disconnect()
}
