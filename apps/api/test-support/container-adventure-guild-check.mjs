import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import {
  createDatabaseClient,
  readAdventureCharacters,
  readDatabaseConfiguration,
  readGuild,
  recordCharacter,
  recordCharacterBasic,
  replaceTimelineRange
} from '@dfragon/database'
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

  // 합성 클리어다. 천해천 둘째 주 목요일 정오에 읽어 이번 주는 04-02 06:00, 최근 4주는 03-12 06:00부터다.
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
  const clears = [
    [
      { serverId: 'siroco', characterId: 'adventure-high' },
      [
        raid(201, '03-12T05:59:00', '합성 4주 밖 레이드'),
        raid(210, '03-12T06:00:00', '합성 4주 레이드'),
        raid(201, '04-02T05:59:00', '합성 지난주 레이드'),
        raid(201, '04-02T06:00:00', '디레지에 레이드')
      ]
    ],
    [{ serverId: 'cain', characterId: 'adventure-low' }, [legion('04-02T07:00:00', '베누스')]],
    [
      { serverId: 'hilder', characterId: 'guild-no-fame' },
      [raid(201, '04-02T08:00:00', '합성 다른 모험단 레이드')]
    ]
  ]
  for (const [character, events] of clears) {
    await replaceTimelineRange(client, character, range, events, [])
  }

  const weekly = await readAdventureWeeklyClears(client, adventureName, now)
  assert.deepEqual(weekly.clearNames, [
    { kind: 'raid', name: '디레지에 레이드' },
    { kind: 'raid', name: '합성 4주 레이드' },
    { kind: 'raid', name: '합성 지난주 레이드' },
    { kind: 'legion', name: '베누스' }
  ])
  assert.deepEqual(
    weekly.characters.map(({ characterId, weeklyClears }) => [characterId, weeklyClears]),
    [
      ['adventure-high', [{ kind: 'raid', name: '디레지에 레이드' }]],
      ['adventure-low', [{ kind: 'legion', name: '베누스' }]],
      ['adventure-no-fame', []],
      ['adventure-no-basic', []]
    ]
  )
  assert.deepEqual(weekly.characters.at(-1), { ...adventure.at(-1), weeklyClears: [] })
  assert.deepEqual(await readAdventureWeeklyClears(client, '없는모험단', now), {
    clearNames: [],
    characters: []
  })

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
  // 합성 클리어는 지금 시각의 4주보다 오래돼 비고, 동기화 요청은 internal network라 기록만 남기고 실패한다.
  const weeklyAnswer = await get(`/adventures/${encodeURIComponent(adventureName)}/weekly`)
  assert.equal(weeklyAnswer.adventureName, adventureName)
  assert.deepEqual(weeklyAnswer.clearNames, [])
  assert.deepEqual(
    weeklyAnswer.characters.map(({ characterId, weeklyClears }) => [characterId, weeklyClears]),
    [
      ['adventure-high', []],
      ['adventure-low', []],
      ['adventure-no-fame', []],
      ['adventure-no-basic', []]
    ]
  )
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
