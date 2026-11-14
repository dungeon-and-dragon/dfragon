import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  finishContentClearCollection,
  readClearPopulation,
  readContentClearAdventureSizes,
  readContentClearCoClears,
  readContentClearCollectedAt,
  readContentClearCollection,
  readContentClearFameBands,
  readContentClearFames,
  readContentClearFirstWeeks,
  readContentClearJobFames,
  readContentClearPopulations,
  readContentClearRaidTimes,
  readContentClearStageMoves,
  readContentClearStreaks,
  readContentClearWeekGroups,
  readContentClearWeekRatioCounts,
  readClearRecordLegionWeeks,
  readClearRecordRaidModes,
  readClearRecordRaidStageCounts,
  readContentClearJobScores,
  readContentClearScoreBands,
  readContentClearScores,
  readContentClearWeekGroupScores,
  readDatabaseConfiguration,
  readSelectedContentClearJobFames,
  readSelectedContentClearJobScores,
  readSelectedContentClearTimes,
  recordCharacterBasic,
  recordCharacterScore,
  recordClearRecords,
  recordContentClearCollectionProgress,
  recordContentClearPopulation,
  recordContentClears,
  startContentClearCollection
} from '@dfragon/database'
import { ClearStatsService } from './dist/application/content-clears/service.js'

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

  const reader = {
    readCollectedAt: () => readContentClearCollectedAt(client),
    readPopulations: () => readContentClearPopulations(client),
    readWeekRatioCounts: () => readContentClearWeekRatioCounts(client),
    readAdventureSizes: (selection) => readContentClearAdventureSizes(client, selection),
    readFames: (weekStart) => readContentClearFames(client, weekStart),
    readJobFames: (weekStart) => readContentClearJobFames(client, weekStart),
    readCoClears: (weekStart) => readContentClearCoClears(client, weekStart),
    readRaidTimes: (weekStart) => readContentClearRaidTimes(client, weekStart),
    readContentJobFames: (selection) => readSelectedContentClearJobFames(client, selection),
    readContentTimes: (selection) => readSelectedContentClearTimes(client, selection),
    readFirstWeeks: (contentId) => readContentClearFirstWeeks(client, contentId),
    readFameBands: (selection, minFame) => readContentClearFameBands(client, selection, minFame),
    readWeekGroups: (comparison) => readContentClearWeekGroups(client, comparison),
    readStageMoves: (selection) => readContentClearStageMoves(client, selection),
    readStreaks: (selection) => readContentClearStreaks(client, selection),
    readLegionWeeks: (names) => readClearRecordLegionWeeks(client, names),
    readRaidModes: (selection) => readClearRecordRaidModes(client, selection),
    readRaidStageCounts: (selection, stages) =>
      readClearRecordRaidStageCounts(client, selection, stages),
    readContentJobScores: (selection) => readSelectedContentClearJobScores(client, selection),
    readWeekGroupScores: (comparison) => readContentClearWeekGroupScores(client, comparison),
    readScoreBands: (selection, minFame) => readContentClearScoreBands(client, selection, minFame),
    readScores: (weekStart) => readContentClearScores(client, weekStart),
    readJobScores: (weekStart) => readContentClearJobScores(client, weekStart)
  }
  let refreshFailures = 0
  const reportRefreshFailure = () => {
    refreshFailures += 1
  }
  const service = new ClearStatsService(reader, reportRefreshFailure)
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
  await assert.rejects(service.contentStats('diregie-hard', '2026-02-19'), { kind: 'query' })

  // 수집이 모집단을 저장하기 전의 클리어는 보이지 않는다. 저장한 뒤의 요청은 새 결과를 미리 계산하는 동안 이전 값을 받고, 계산이 끝나면 새 값을 받는다.
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
  assert.equal((await weeksOf('engraved-nightmare-1')).at(-1).cleared, 3)
  await service.refresh()
  assert.equal(refreshFailures, 0)
  assert.equal((await weeksOf('engraved-nightmare-1')).at(-1).cleared, 4)
  assert.equal((await service.contentStats('engraved-nightmare-1', undefined)).week.cleared, 4)

  // 전체 개요다. 명성이 다른 캐릭터 25명이 이번 주 미카엘라 하드를 깨고, 그 가운데 5명은 이번 주까지, 1명은 다음 주에 챌린지를 깬다.
  const fameCharacters = Array.from({ length: 25 }, (_, index) => `clear-fame-${index + 1}`)
  for (const [index, characterId] of fameCharacters.entries()) {
    await recordCharacterBasic(
      client,
      basic('cain', characterId, 101000 + index * 1000, '합성클리어모험단3')
    )
  }
  await recordContentClears(client, [
    ...fameCharacters.map((characterId, index) =>
      clear(
        'michaela-hard',
        'raid',
        characterId,
        index < 10 ? '2026-11-12T02:30:00' : '2026-11-05T07:00:00',
        thisWeek
      )
    ),
    ...fameCharacters
      .slice(0, 5)
      .map((characterId) =>
        clear('engraved-nightmare-1', 'challenge', characterId, '2026-11-07T23:00:00', thisWeek)
      ),
    clear(
      'engraved-nightmare-1',
      'challenge',
      fameCharacters[5],
      '2026-11-13T23:00:00',
      '2026-11-12T06:00:00'
    )
  ])
  await recordContentClearPopulation(client, population(500, true, 'michaela-normal'))
  // 위 service는 모집단의 마지막 수집 시각이 그대로라 캐시를 주므로 새 service로 읽는다.
  const overviewService = new ClearStatsService(reader, reportRefreshFailure)
  const overview = await overviewService.overview('2026-11-05')
  const overviewContent = (id) => overview.contents.find((content) => content.id === id)
  const michaelaOverview = overviewContent('michaela-hard')
  const challengeOverview = overviewContent('engraved-nightmare-1')
  assert.deepEqual(
    overview.contents.map(({ id, cleared }) => [id, cleared]),
    [
      ['michaela-normal', 1],
      ['michaela-hard', 29],
      ['engraved-nightmare-1', 7]
    ]
  )
  // 명성이 있는 28명(1,000 세 명과 101,000~125,000)에서 p 분위수는 ceil(p × 28)번째로 작은 값이다.
  assert.deepEqual(michaelaOverview.fame, {
    p5: 1000,
    p25: 104000,
    median: 111000,
    p75: 118000,
    p95: 124000,
    max: 125000
  })
  assert.equal(challengeOverview.fame, null)
  assert.equal(
    michaelaOverview.jobs.reduce((total, { cleared }) => total + cleared, 0),
    (await overviewService.stats()).contents
      .find(({ id }) => id === 'michaela-hard')
      .weeks.find(({ weekStart }) => weekStart === '2026-11-05').cleared
  )
  assert.deepEqual(
    michaelaOverview.jobs
      .map(({ jobGrowId, cleared, fame }) => [jobKey({ jobGrowId }), cleared, fame?.median ?? null])
      .sort(([left], [right]) => left.localeCompare(right)),
    [
      ['-', 1, null],
      ['synthetic-clear-grow', 27, 112000],
      ['synthetic-clear-other', 1, null]
    ]
  )
  assert.deepEqual(
    overview.contents.map(({ id, coClears }) => [id, coClears]),
    [
      [
        'michaela-normal',
        [
          { id: 'michaela-hard', cleared: 1 },
          { id: 'engraved-nightmare-1', cleared: 1 }
        ]
      ],
      [
        'michaela-hard',
        [
          { id: 'michaela-normal', cleared: 1 },
          { id: 'engraved-nightmare-1', cleared: 6 }
        ]
      ],
      [
        'engraved-nightmare-1',
        [
          { id: 'michaela-normal', cleared: 1 },
          { id: 'michaela-hard', cleared: 6 }
        ]
      ]
    ]
  )
  // 목요일 02:30은 그 주 끝(다음 목요일 06:00 전)이라 같은 주의 목요일로 센다.
  assert.deepEqual(overview.weekdays, [
    { weekday: 4, cleared: 25 },
    { weekday: 5, cleared: 2 },
    { weekday: 6, cleared: 1 },
    { weekday: 7, cleared: 2 },
    { weekday: 1, cleared: 0 },
    { weekday: 2, cleared: 0 },
    { weekday: 3, cleared: 0 }
  ])
  assert.deepEqual(
    overview.hours.filter(({ cleared }) => cleared > 0),
    [
      { hour: 2, cleared: 10 },
      { hour: 7, cleared: 15 },
      { hour: 20, cleared: 2 },
      { hour: 21, cleared: 3 }
    ]
  )
  const overviewJson = JSON.stringify(overview)
  for (const identifier of ['"clear-', '합성clear', '합성클리어모험단']) {
    assert.ok(!overviewJson.includes(identifier), identifier)
  }

  // 컨텐츠 상세다. 미카엘라 하드에서 clear-a는 3주 연속, clear-c는 지난주를 건너뛰고 복귀, clear-g는 이번 주에 이탈한다.
  // 일반 단계는 clear-d가 지난주에만, clear-h가 두 주 모두 깬다.
  const twoWeeksAgo = '2026-10-22T06:00:00'
  await recordContentClears(client, [
    clear('michaela-hard', 'raid', 'clear-a', '2026-10-23T20:00:00', twoWeeksAgo),
    clear('michaela-hard', 'raid', 'clear-c', '2026-10-23T20:00:00', twoWeeksAgo),
    clear('michaela-hard', 'raid', 'clear-g', '2026-10-30T20:00:00', lastWeek),
    clear('michaela-normal', 'raid', 'clear-d', '2026-10-30T20:00:00', lastWeek),
    clear('michaela-normal', 'raid', 'clear-h', '2026-10-30T20:00:00', lastWeek),
    clear('michaela-normal', 'raid', 'clear-h', '2026-11-06T20:00:00', thisWeek)
  ])
  const detail = await new ClearStatsService(reader, reportRefreshFailure).contentStats(
    'michaela-hard',
    '2026-11-05'
  )
  assert.equal(detail.week.cleared, 29)
  // 이번 주 첫 클리어 27명은 명성 1,000 두 명과 101,000~125,000이라 p 분위수는 ceil(p × 27)번째로 작은 값이다.
  const noScores = { equipment: null, buff: null }
  assert.deepEqual(detail.weekOverWeek, {
    both: { cleared: 1, fame: null, scores: noScores },
    returned: { cleared: 1, fame: null, scores: noScores },
    left: { cleared: 1, fame: null, scores: noScores },
    first: {
      cleared: 27,
      fame: { p5: 1000, p25: 105000, median: 112000, p75: 119000, p95: 124000, max: 125000 },
      scores: noScores
    }
  })
  assert.deepEqual(detail.stageMoves, {
    hard: { same: 1, other: 1, none: 27 },
    normal: { same: 1, other: 1, none: 0 }
  })
  assert.deepEqual(detail.streaks, [
    { weeks: 1, characters: 28 },
    { weeks: 3, characters: 1 }
  ])
  assert.deepEqual(detail.weeklyClears, [
    {
      weekStart: '2026-10-29',
      population: 1100,
      firstCleared: 1,
      repeatCleared: 1,
      everCleared: 3
    },
    {
      weekStart: '2026-11-05',
      population: 1200,
      firstCleared: 27,
      repeatCleared: 2,
      everCleared: 30
    }
  ])
  assert.equal(
    detail.jobs.reduce((total, { cleared }) => total + cleared, 0),
    detail.week.cleared
  )
  assert.equal(
    detail.weekdays.reduce((total, { cleared }) => total + cleared, 0),
    detail.week.cleared
  )
  assert.equal(
    detail.hours.reduce((total, { cleared }) => total + cleared, 0),
    detail.week.cleared
  )
  // 앞 단계가 넣은 캐릭터도 모집단에 들어 구간별 캐릭터 수는 합성 캐릭터만으로 정하지 않는다.
  const bandOf = (fame) => detail.fameBands.find((band) => band.fame === fame)
  assert.deepEqual(bandOf(0), { fame: 0, population: 0, cleared: 3 })
  assert.equal(bandOf(124000).cleared, 2)
  assert.ok(bandOf(900000).population >= 5)
  assert.ok(detail.fameBands.every(({ fame, population }) => population === 0 || fame >= 126000))
  assert.equal(
    detail.fameBands.reduce((total, { cleared }) => total + cleared, 0),
    28
  )
  const challengeDetail = await new ClearStatsService(reader, reportRefreshFailure).contentStats(
    'engraved-nightmare-1',
    '2026-11-05'
  )
  assert.deepEqual(
    [challengeDetail.weekOverWeek, challengeDetail.stageMoves, challengeDetail.streaks],
    [null, null, null]
  )

  // 레기온, 단계별 기록이다. clear-l1은 같은 주에 베누스를 두 번 깨고, 화면에 쓰지 않는 레기온 기록도 섞는다.
  const record = (kind, characterId, name, clearedAt, weekStart, raid = {}) => ({
    kind,
    serverId: 'cain',
    characterId,
    name,
    clearedAt: at(clearedAt),
    weekStart: at(weekStart),
    ...(kind === 'raid' ? { modeName: null, hard: false, partyName: null, ...raid } : {})
  })
  const michaelaRaid = '무너진 성자 미카엘라'
  await recordClearRecords(client, [
    record('legion', 'clear-l1', '베누스', '2026-11-06T20:00:00', thisWeek),
    record('legion', 'clear-l1', '베누스', '2026-11-08T20:00:00', thisWeek),
    record('legion', 'clear-l2', '베누스', '2026-11-07T20:00:00', thisWeek),
    record('legion', 'clear-l2', '베누스', '2026-10-30T20:00:00', lastWeek),
    record('legion', 'clear-l1', '어둑섬', '2026-11-07T20:00:00', thisWeek),
    record('raid', 'clear-p', michaelaRaid, '2026-11-06T20:00:00', thisWeek, {
      modeName: michaelaRaid,
      hard: true
    }),
    record('raid', 'clear-p', michaelaRaid, '2026-11-07T20:00:00', thisWeek, {
      modeName: michaelaRaid
    }),
    record('raid', 'clear-q', michaelaRaid, '2026-11-06T21:00:00', thisWeek, {
      modeName: '미카엘라 : 균열서'
    }),
    record('raid', 'clear-q', michaelaRaid, '2026-11-08T21:00:00', thisWeek, {
      modeName: '미카엘라 : 균열서'
    }),
    record('raid', 'clear-r', michaelaRaid, '2026-11-07T21:00:00', thisWeek, {
      modeName: michaelaRaid
    }),
    record('raid', 'clear-r', michaelaRaid, '2026-10-30T21:00:00', lastWeek, {
      modeName: michaelaRaid,
      hard: true
    })
  ])

  // 점수는 클리어 행에 복사한 값을 쓴다. 이번 주 미카엘라 하드에서 clear-fame-1~22는 엔진 A의 장비 점수,
  // clear-fame-23~25는 엔진 B의 장비 점수, clear-e는 엔진 A의 버프 점수다.
  const engineA = ['synthetic-engine', 'rules-a', 'bundle-a']
  const engineB = ['synthetic-engine', 'rules-b', 'bundle-b']
  const copyScore = (characterId, kind, score, [enginePackage, rulesRev, bundleId]) =>
    client.$executeRaw`
      UPDATE content_clears
      SET score = ${score}, score_kind = ${kind}, score_engine_package = ${enginePackage},
        score_engine_rules_rev = ${rulesRev}, score_engine_bundle_id = ${bundleId}
      WHERE content_id = 'michaela-hard' AND character_id = ${characterId}
        AND week_start = ${at(thisWeek)}`
  for (const [index, characterId] of fameCharacters.entries()) {
    const score = index < 22 ? 901000 + index * 1000 : 2000000
    await copyScore(characterId, 'equipment', score, index < 22 ? engineA : engineB)
  }
  await copyScore('clear-e', 'buff', 150000, engineA)
  // 복사한 명성이 있으면 캐릭터의 지금 최고 명성보다 먼저 쓴다.
  await client.$executeRaw`
    UPDATE content_clears SET max_fame = 130000
    WHERE content_id = 'michaela-hard' AND character_id = 'clear-fame-25'
      AND week_start = ${at(thisWeek)}`
  for (const characterId of ['clear-top', 'clear-dropped']) {
    await recordCharacterScore(client, {
      serverId: 'cain',
      characterId,
      kind: 'equipment',
      score: 905000,
      calculatedAt: at('2026-11-10T06:00:00'),
      engine: { package: engineA[0], rulesRev: engineA[1], bundleId: engineA[2] }
    })
  }

  const scoredService = new ClearStatsService(reader, reportRefreshFailure)
  const scoredList = await scoredService.stats()
  const venus = scoredList.legions.find(({ id }) => id === 'legion-venus')
  assert.deepEqual(
    venus.weeks.map(({ weekStart, cleared }) => [weekStart, cleared]),
    [
      ['2026-10-29', 1],
      ['2026-11-05', 2],
      ['2026-11-12', 0]
    ]
  )
  assert.deepEqual(scoredList.legions.find(({ id }) => id === 'legion-apocalypse').weeks, [])
  assert.ok(scoredList.contents.every(({ kind }) => kind !== 'legion'))

  const scoredOverview = await scoredService.overview('2026-11-05')
  const scoredMichaela = scoredOverview.contents.find(({ id }) => id === 'michaela-hard')
  assert.equal(scoredMichaela.fame.max, 130000)
  assert.deepEqual(scoredMichaela.scores, {
    equipment: { p5: 902000, p25: 906000, median: 911000, p75: 917000, p95: 921000, max: 922000 },
    buff: null
  })
  const scoredGrow = scoredMichaela.jobs.find(
    ({ jobGrowId }) => jobGrowId === 'synthetic-clear-grow'
  )
  assert.equal(scoredGrow.scores.equipment.max, 922000)
  assert.equal(scoredGrow.scores.buff, null)

  const scoredDetail = await scoredService.contentStats('michaela-hard', '2026-11-05')
  assert.deepEqual(scoredDetail.stages, [
    { stage: '싱글/매칭', characters: 1 },
    { stage: '일반', characters: 2 },
    { stage: '하드', characters: 1 }
  ])
  assert.equal(scoredDetail.weekOverWeek.first.fame.max, 130000)
  // 명성 구간은 분모와 같은 지금 최고 명성으로 세므로 복사한 명성 130,000은 구간에 쓰지 않는다.
  assert.equal(
    scoredDetail.fameBands.find(({ fame }) => fame === 130000),
    undefined
  )
  assert.equal(scoredDetail.fameBands.find(({ fame }) => fame === 124000).cleared, 2)
  assert.equal(scoredDetail.weekOverWeek.first.scores.equipment.max, 922000)
  assert.equal(scoredDetail.weekOverWeek.first.scores.buff, null)
  assert.deepEqual(scoredDetail.weekOverWeek.both.scores, { equipment: null, buff: null })
  assert.deepEqual(scoredDetail.scoreBands, {
    equipment: [{ score: 900000, population: 2, cleared: 22 }],
    buff: [{ score: 150000, population: 0, cleared: 1 }]
  })
  const legionDetail = await scoredService.contentStats('legion-venus', '2026-11-05')
  assert.deepEqual(
    [legionDetail.kind, legionDetail.week.cleared, legionDetail.stages],
    ['legion', 2, null]
  )
  const challengeScored = await scoredService.contentStats('engraved-nightmare-1', '2026-11-05')
  assert.deepEqual(challengeScored.scoreBands, { equipment: [], buff: [] })
  assert.equal(challengeScored.stages, null)

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
