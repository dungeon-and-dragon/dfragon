import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readClearPopulation,
  readDatabaseConfiguration,
  recordCharacterBasic,
  recordContentClearPopulation,
  recordContentClears
} from '@dfragon/database'

// 합성 캐릭터와 클리어 기록이다. 명성은 앞 단계가 넣은 캐릭터보다 높게 두어 모집단의 맨 앞에 온다.
const at = (time) => new Date(`${time}+09:00`)
const basic = (serverId, characterId, fame) => ({
  serverId,
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성클리어모험단',
  level: 115,
  jobId: 'synthetic-clear-job',
  jobGrowId: 'synthetic-clear-grow',
  jobName: '합성직업',
  jobGrowName: '합성전직',
  fame,
  guildId: null,
  guildName: null
})
const clear = (contentId, kind, characterId, clearedAt, weekStart, ratio = null) => ({
  contentId,
  kind,
  serverId: 'cain',
  characterId,
  clearedAt: at(clearedAt),
  weekStart: at(weekStart),
  ratio
})
const population = (population, closed) => ({
  contentId: 'michaela-hard',
  weekStart: at('2026-11-05T06:00:00'),
  population,
  minFame: 126000,
  jobs: [
    {
      jobId: 'synthetic-clear-job',
      jobGrowId: 'synthetic-clear-grow',
      jobName: '합성직업',
      jobGrowName: '합성전직',
      count: population
    }
  ],
  collectedAt: at('2026-11-10T06:00:00'),
  closed
})
const thisWeek = '2026-11-05T06:00:00'
const lastWeek = '2026-10-29T06:00:00'
// 같은 주에 두 번 깬 레이드, 다른 주의 같은 레이드, 같은 칭호를 다른 주에 다시 얻은 기록을 섞는다.
const clears = [
  clear('michaela-hard', 'raid', 'clear-a', '2026-11-07T21:15:00', thisWeek, 500),
  clear('michaela-hard', 'raid', 'clear-a', '2026-11-06T20:00:00', thisWeek, 150),
  clear('michaela-hard', 'raid', 'clear-a', '2026-10-30T20:00:00', lastWeek),
  clear('michaela-normal', 'raid', 'clear-a', '2026-11-08T20:00:00', thisWeek),
  clear(
    'engraved-nightmare-1',
    'challenge',
    'clear-a',
    '2026-11-13T23:59:00',
    '2026-11-12T06:00:00'
  ),
  clear('engraved-nightmare-1', 'challenge', 'clear-a', '2026-11-06T23:59:00', thisWeek),
  clear('engraved-nightmare-1', 'challenge', 'clear-b', '2026-11-09T01:00:00', thisWeek)
]
const storedClears = (client) =>
  client.$queryRaw`
    SELECT content_id || ':' || kind || ':' || character_id || ':' ||
      to_char(week_start AT TIME ZONE 'Asia/Seoul', 'MM-DD') || ':' ||
      to_char(cleared_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') || ':' ||
      coalesce(ratio::text, '-') AS row
    FROM content_clears
    ORDER BY 1`

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await recordContentClears(client, clears)
  const expectedClears = [
    'engraved-nightmare-1:challenge:clear-a:11-05:11-06 23:59:-',
    'engraved-nightmare-1:challenge:clear-b:11-05:11-09 01:00:-',
    'michaela-hard:raid:clear-a:10-29:10-30 20:00:-',
    'michaela-hard:raid:clear-a:11-05:11-06 20:00:150',
    'michaela-normal:raid:clear-a:11-05:11-08 20:00:-'
  ]
  assert.deepEqual(
    (await storedClears(client)).map(({ row }) => row),
    expectedClears
  )
  // 같은 주의 늦은 레이드 클리어와 다른 주의 늦은 칭호 획득만 다시 저장해도 이른 클리어가 남는다.
  await recordContentClears(client, [clears[0], clears[4]])
  assert.deepEqual(
    (await storedClears(client)).map(({ row }) => row),
    expectedClears
  )
  // 같은 기록을 따로, 늦은 기록부터 다시 저장해도 행이 늘거나 이른 클리어가 바뀌지 않는다.
  for (const row of clears) {
    await recordContentClears(client, [row])
  }
  await recordContentClears(client, clears.toReversed())
  assert.deepEqual(
    (await storedClears(client)).map(({ row }) => row),
    expectedClears
  )
  await assert.rejects(
    client.$executeRaw`
      INSERT INTO content_clears (content_id, kind, server_id, character_id, week_start, cleared_at)
      VALUES ('michaela-hard', 'legion', 'cain', 'clear-a', now(), now())`
  )

  await recordContentClearPopulation(client, population(1000, false))
  await recordContentClearPopulation(client, population(1200, true))
  // 마감한 주의 분모는 다시 저장해도 바뀌지 않는다.
  await recordContentClearPopulation(client, population(900, false))
  assert.deepEqual(
    await client.$queryRaw`
      SELECT population, min_fame AS "minFame", jobs->0->>'count' AS "jobCount", closed
      FROM content_clear_populations`,
    [{ population: 1200, minFame: 126000, jobCount: '1200', closed: true }]
  )

  for (const character of [
    basic('siroco', 'clear-tie', 900000),
    basic('cain', 'clear-tie-2', 900000),
    basic('cain', 'clear-tie', 900000),
    basic('cain', 'clear-top', 900001),
    basic('cain', 'clear-no-fame', null)
  ]) {
    await recordCharacterBasic(client, character)
  }
  const characters = await readClearPopulation(client)
  assert.deepEqual(characters.slice(0, 4), [
    {
      serverId: 'cain',
      characterId: 'clear-top',
      fame: 900001,
      jobId: 'synthetic-clear-job',
      jobGrowId: 'synthetic-clear-grow',
      jobName: '합성직업',
      jobGrowName: '합성전직'
    },
    ...[
      ['cain', 'clear-tie'],
      ['cain', 'clear-tie-2'],
      ['siroco', 'clear-tie']
    ].map(([serverId, characterId]) => ({
      serverId,
      characterId,
      fame: 900000,
      jobId: 'synthetic-clear-job',
      jobGrowId: 'synthetic-clear-grow',
      jobName: '합성직업',
      jobGrowName: '합성전직'
    }))
  ])
  assert.ok(characters.every(({ fame }) => fame !== null))
} finally {
  await client.$disconnect()
}
