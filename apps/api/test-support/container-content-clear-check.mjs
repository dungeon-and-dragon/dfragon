import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  finishContentClearCollection,
  readClearPopulation,
  readContentClearAdventureSizes,
  readContentClearCollectedAt,
  readContentClearCollection,
  readContentClearJobCounts,
  readContentClearPopulations,
  readContentClearWeekRatioCounts,
  readDatabaseConfiguration,
  recordCharacterBasic,
  recordContentClearCollectionProgress,
  recordContentClearPopulation,
  recordContentClears,
  startContentClearCollection
} from '@dfragon/database'
import { createClearStatsService } from './dist/content-clears/stats.js'

// 합성 캐릭터와 클리어 기록이다. 최고 명성은 앞 단계가 넣은 캐릭터보다 높게 두어 모집단의 맨 앞에 온다.
const at = (time) => new Date(`${time}+09:00`)
const basic = (
  serverId,
  characterId,
  fame,
  adventureName = '합성클리어모험단',
  jobGrowId = 'synthetic-clear-grow'
) => ({
  serverId,
  characterId,
  characterName: `합성${characterId}`,
  adventureName,
  level: 115,
  jobId: 'synthetic-clear-job',
  jobGrowId,
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
const population = (
  population,
  closed,
  contentId = 'michaela-hard',
  weekStart = '2026-11-05T06:00:00',
  collectedAt = '2026-11-10T06:00:00'
) => ({
  contentId,
  weekStart: at(weekStart),
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
  collectedAt: at(collectedAt),
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

  // 수집 하한(최신 컨텐츠의 가장 낮은 입장 명성)이다. 장비를 벗어 지금 명성이 내려간 캐릭터도 최고 명성으로 든다.
  const collectionMinFame = 104292
  for (const character of [
    basic('siroco', 'clear-tie', 900000),
    basic('cain', 'clear-tie-2', 900000),
    basic('cain', 'clear-tie', 900000),
    basic('cain', 'clear-top', 900001),
    basic('cain', 'clear-dropped', 900002),
    basic('cain', 'clear-dropped', 1000),
    basic('cain', 'clear-floor', collectionMinFame),
    basic('cain', 'clear-below-floor', collectionMinFame - 1),
    basic('cain', 'clear-no-fame', null)
  ]) {
    await recordCharacterBasic(client, character)
  }
  const populationCharacter = (serverId, characterId, maxFame) => ({
    serverId,
    characterId,
    maxFame,
    jobId: 'synthetic-clear-job',
    jobGrowId: 'synthetic-clear-grow',
    jobName: '합성직업',
    jobGrowName: '합성전직'
  })
  const characters = await readClearPopulation(client, collectionMinFame)
  assert.deepEqual(characters.slice(0, 5), [
    populationCharacter('cain', 'clear-dropped', 900002),
    populationCharacter('cain', 'clear-top', 900001),
    populationCharacter('cain', 'clear-tie', 900000),
    populationCharacter('cain', 'clear-tie-2', 900000),
    populationCharacter('siroco', 'clear-tie', 900000)
  ])
  assert.deepEqual(
    characters.filter(({ characterId }) => characterId.startsWith('clear-')).at(-1),
    populationCharacter('cain', 'clear-floor', collectionMinFame)
  )
  assert.ok(characters.every(({ maxFame }) => maxFame >= collectionMinFame))
  assert.ok(
    !characters.some(({ characterId }) =>
      ['clear-below-floor', 'clear-no-fame'].includes(characterId)
    )
  )

  // 예전 상한 10만 명을 넘는 수집 대상도 모두 읽는다.
  const bulkCharacters = 100001
  await client.$executeRaw`
    INSERT INTO characters (server_id, character_id, character_name, adventure_id, max_fame)
    SELECT 'cain', 'clear-bulk-' || n, '합성대량' || n, adventure_id, ${collectionMinFame} + n
    FROM generate_series(1, ${bulkCharacters}) AS n
    CROSS JOIN (SELECT adventure_id FROM characters WHERE character_id = 'clear-top') adventure`
  assert.equal(
    (await readClearPopulation(client, collectionMinFame)).filter(({ characterId }) =>
      characterId.startsWith('clear-bulk-')
    ).length,
    bulkCharacters
  )
  await client.$executeRaw`DELETE FROM characters WHERE character_id LIKE 'clear-bulk-%'`

  // 조회 경로가 읽는 집계다. 앞 단계의 clear-a, clear-b는 캐릭터 행이 없어 전직 없음, 혼자인 모험단으로 센다.
  for (const character of [
    basic('cain', 'clear-c', 1000),
    basic('cain', 'clear-d', 1000),
    basic('cain', 'clear-e', 1000, '합성클리어모험단2', 'synthetic-clear-other')
  ]) {
    await recordCharacterBasic(client, character)
  }
  await recordContentClears(client, [
    clear('michaela-hard', 'raid', 'clear-c', '2026-11-06T21:00:00', thisWeek),
    clear('michaela-hard', 'raid', 'clear-d', '2026-11-07T21:00:00', thisWeek, 500),
    clear('michaela-hard', 'raid', 'clear-e', '2026-11-08T21:00:00', thisWeek),
    clear('diregie-hard', 'raid', 'clear-c', '2026-02-06T21:00:00', '2026-02-05T06:00:00'),
    clear('diregie-hard', 'raid', 'clear-c', '2026-02-13T21:00:00', '2026-02-12T06:00:00'),
    clear('diregie-hard', 'raid', 'clear-d', '2026-02-13T22:00:00', '2026-02-12T06:00:00'),
    clear(
      'engraved-nightmare-1',
      'challenge',
      'clear-c',
      '2026-11-12T23:00:00',
      '2026-11-12T06:00:00'
    )
  ])
  await recordContentClearPopulation(client, population(1100, true, 'michaela-hard', lastWeek))
  await recordContentClearPopulation(
    client,
    population(800, true, 'diregie-hard', '2026-02-05T06:00:00')
  )
  await recordContentClearPopulation(
    client,
    population(810, true, 'diregie-hard', '2026-02-12T06:00:00')
  )
  await recordContentClearPopulation(client, population(1000, true, 'engraved-nightmare-1'))
  await recordContentClearPopulation(
    client,
    population(1000, false, 'engraved-nightmare-1', '2026-11-12T06:00:00', '2026-11-13T06:00:00')
  )

  const service = createClearStatsService({
    readCollectedAt: () => readContentClearCollectedAt(client),
    readPopulations: () => readContentClearPopulations(client),
    readWeekRatioCounts: () => readContentClearWeekRatioCounts(client),
    readJobCounts: (selection) => readContentClearJobCounts(client, selection),
    readAdventureSizes: (selection) => readContentClearAdventureSizes(client, selection)
  })
  const weeksOf = async (contentId) =>
    (await service.stats()).contents.find(({ id }) => id === contentId).weeks
  const summary = (weeks) =>
    weeks.map(({ weekStart, closed, population, cleared, newlyCleared, ratios }) => ({
      weekStart,
      closed,
      population,
      cleared,
      newlyCleared,
      ratios
    }))
  assert.deepEqual(summary(await weeksOf('michaela-hard')), [
    {
      weekStart: '2026-10-29',
      closed: true,
      population: 1100,
      cleared: 1,
      newlyCleared: null,
      ratios: [{ ratio: null, cleared: 1 }]
    },
    {
      weekStart: '2026-11-05',
      closed: true,
      population: 1200,
      cleared: 4,
      newlyCleared: null,
      ratios: [
        { ratio: null, cleared: 2 },
        { ratio: 150, cleared: 1 },
        { ratio: 500, cleared: 1 }
      ]
    }
  ])
  assert.deepEqual(
    summary(await weeksOf('engraved-nightmare-1')).map(({ weekStart, cleared, newlyCleared }) => [
      weekStart,
      cleared,
      newlyCleared
    ]),
    [
      ['2026-11-05', 2, 2],
      ['2026-11-12', 3, 1]
    ]
  )
  assert.deepEqual(
    summary(await weeksOf('diregie-hard')).map(({ weekStart, cleared }) => [weekStart, cleared]),
    [
      ['2026-02-05', 1],
      ['2026-02-12', 2]
    ]
  )
  assert.deepEqual(await weeksOf('nabel-normal'), [])

  const michaela = await service.contentStats('michaela-hard', undefined)
  assert.equal(michaela.week.weekStart, '2026-11-05')
  const jobKey = ({ jobGrowId }) => jobGrowId ?? '-'
  assert.deepEqual(
    michaela.jobs
      .map((job) => [jobKey(job), job.population, job.cleared])
      .sort(([left], [right]) => left.localeCompare(right)),
    [
      ['-', 0, 1],
      ['synthetic-clear-grow', 1200, 2],
      ['synthetic-clear-other', 0, 1]
    ]
  )
  assert.deepEqual(michaela.adventures, [
    { characters: 1, adventures: 2 },
    { characters: 2, adventures: 1 }
  ])
  const challenge = await service.contentStats('engraved-nightmare-1', '2026-11-12')
  assert.equal(challenge.week.cleared, 3)
  assert.equal(
    challenge.jobs.reduce((total, { cleared }) => total + cleared, 0),
    challenge.week.cleared
  )
  assert.equal(
    challenge.adventures.reduce(
      (total, { characters, adventures }) => total + characters * adventures,
      0
    ),
    challenge.week.cleared
  )
  assert.equal((await service.contentStats('diregie-hard', '2026-02-05')).week.cleared, 1)
  await assert.rejects(service.contentStats('diregie-hard', '2026-02-19'), { status: 400 })

  // 수집이 모집단을 저장하기 전의 클리어는 보이지 않고, 저장한 뒤의 요청은 새 값을 받는다.
  await recordContentClears(client, [
    clear(
      'engraved-nightmare-1',
      'challenge',
      'clear-d',
      '2026-11-13T23:00:00',
      '2026-11-12T06:00:00'
    )
  ])
  assert.equal((await weeksOf('engraved-nightmare-1')).at(-1).cleared, 3)
  await recordContentClearPopulation(
    client,
    population(1000, false, 'engraved-nightmare-1', '2026-11-12T06:00:00', '2026-11-14T06:00:00')
  )
  assert.equal((await weeksOf('engraved-nightmare-1')).at(-1).cleared, 4)
  assert.equal((await service.contentStats('engraved-nightmare-1', undefined)).week.cleared, 4)

  // 수집 진행 위치는 끝나기 전까지만 남는다.
  const collectionStartedAt = at('2026-11-10T06:00:00')
  assert.equal(await readContentClearCollection(client), undefined)
  await startContentClearCollection(client, collectionStartedAt)
  await recordContentClearCollectionProgress(client, { startedAt: collectionStartedAt, done: 300 })
  assert.deepEqual(await readContentClearCollection(client), {
    startedAt: collectionStartedAt,
    done: 300
  })
  await finishContentClearCollection(client, collectionStartedAt)
  assert.equal(await readContentClearCollection(client), undefined)
} finally {
  await client.$disconnect()
}
