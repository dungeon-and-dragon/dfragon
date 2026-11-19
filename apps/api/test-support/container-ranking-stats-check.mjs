import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readCharacterStats,
  readDatabaseConfiguration,
  readFameRanking,
  recordCharacterBasic,
  recordCharacterSets
} from '@dfragon/database'
import {
  StatsJobService,
  createCharacterStatsJob
} from './dist/application/ranking-stats/stats-jobs.js'
import { DatabaseStatsJobRepository } from './dist/infrastructure/database/stats-jobs.js'

// 합성 캐릭터다. 앞 단계가 넣은 행이 있어 통계는 넣기 전후의 차이로 확인한다.
const jobId = 'synthetic-rank-job'
const limitJobId = 'synthetic-limit-job'
const bucketJobId = 'synthetic-bucket-job'
const basic = (serverId, characterId, jobGrowId, fame, job = jobId) => ({
  serverId,
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성랭킹모험단',
  level: 115,
  jobId: job,
  jobGrowId,
  jobName: '합성직업',
  jobGrowName: `합성${jobGrowId}`,
  fame,
  guildId: null,
  guildName: null
})
const ids = (rows) => rows.map(({ serverId, characterId }) => `${serverId}/${characterId}`)
const bucketCounts = ({ fameDistribution }) =>
  new Map(fameDistribution.map(({ from, to, count }) => [from, { to, count }]))
const serverCounts = ({ servers }) =>
  new Map(servers.map(({ serverId, count }) => [serverId, count]))

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  const before = await readCharacterStats(client)
  // 1천 단위 구간 경계 앞뒤의 명성(69999, 70000, 79999, 80000, 124999, 125000)과 명성이 없는 캐릭터를 둔다.
  for (const character of [
    basic('cain', 'rank-a1', 'grow-a', 80000),
    basic('siroco', 'rank-a2', 'grow-a', 79999),
    basic('cain', 'rank-b1', 'grow-b', 70000),
    basic('cain', 'rank-b2', 'grow-b', 69999),
    basic('bakal', 'rank-no-fame', 'grow-b', null),
    basic('bakal', 'bucket-1', 'grow-bucket', 124500, bucketJobId),
    basic('bakal', 'bucket-2', 'grow-bucket', 124999, bucketJobId),
    basic('bakal', 'bucket-3', 'grow-bucket', 125000, bucketJobId)
  ]) {
    await recordCharacterBasic(client, character)
  }
  for (let index = 1; index <= 101; index++) {
    await recordCharacterBasic(
      client,
      basic('prey', `limit-${index}`, 'grow-limit', 200000 + index, limitJobId)
    )
  }

  const ranking = await readFameRanking(client, { jobId }, 100)
  assert.deepEqual(ids(ranking), ['cain/rank-a1', 'siroco/rank-a2', 'cain/rank-b1', 'cain/rank-b2'])
  const [top] = ranking
  assert.ok(top.fetchedAt instanceof Date)
  assert.deepEqual(
    { ...top, fetchedAt: undefined },
    {
      ...basic('cain', 'rank-a1', 'grow-a', 80000),
      fetchedAt: undefined,
      dealerSkillLearned: null,
      equipmentSet: null,
      oathSet: null
    }
  )
  assert.deepEqual(ids(await readFameRanking(client, { jobId, jobGrowId: 'grow-b' }, 100)), [
    'cain/rank-b1',
    'cain/rank-b2'
  ])
  const limited = await readFameRanking(client, { jobId: limitJobId }, 100)
  assert.equal(limited.length, 100)
  assert.deepEqual([limited[0].fame, limited.at(-1).fame], [200101, 200002])
  const overall = await readFameRanking(client, {}, 100)
  assert.equal(overall.length, 100)
  assert.equal(overall[0].fame, 200101)

  const after = await readCharacterStats(client)
  assert.equal(after.total - before.total, 109)
  const serversBefore = serverCounts(before)
  assert.deepEqual(
    [...serverCounts(after)]
      .map(([serverId, count]) => [serverId, count - (serversBefore.get(serverId) ?? 0)])
      .filter(([, added]) => added > 0)
      .sort(),
    [
      ['bakal', 4],
      ['cain', 3],
      ['prey', 101],
      ['siroco', 1]
    ]
  )
  const bucketsBefore = bucketCounts(before)
  assert.deepEqual(
    [...bucketCounts(after)]
      .map(([from, { to, count }]) => [from, to, count - (bucketsBefore.get(from)?.count ?? 0)])
      .filter(([, , added]) => added > 0),
    [
      [69000, 70000, 1],
      [70000, 71000, 1],
      [79000, 80000, 1],
      [80000, 81000, 1],
      [124000, 125000, 2],
      [125000, 126000, 1],
      [200000, 201000, 101]
    ]
  )
  assert.deepEqual(
    after.jobs.filter((job) => job.jobId === jobId),
    [
      {
        jobId,
        jobGrowId: 'grow-b',
        jobName: '합성직업',
        jobGrowName: '합성grow-b',
        count: 3,
        averageFame: 69999.5
      },
      {
        jobId,
        jobGrowId: 'grow-a',
        jobName: '합성직업',
        jobGrowName: '합성grow-a',
        count: 2,
        averageFame: 79999.5
      }
    ]
  )

  // network namespace를 함께 쓰는 API 컨테이너를 불러 runtime 연결과 저장분 읽기까지 확인한다.
  const get = async (path) => {
    const response = await fetch(new URL(path, 'http://127.0.0.1:3000'))
    assert.equal(response.status, 200, path)

    return response.json()
  }
  const rankingAnswer = await get(`/rankings/fame?jobId=${jobId}&jobGrowId=grow-b`)
  assert.deepEqual(
    rankingAnswer.characters.map(({ rank, characterId }) => [rank, characterId]),
    [
      [1, 'rank-b1'],
      [2, 'rank-b2']
    ]
  )
  assert.deepEqual(await get('/stats'), {
    total: 0,
    servers: [],
    jobs: [],
    fameDistribution: [],
    computedAt: null
  })
  const statsJob = createCharacterStatsJob(
    new StatsJobService(new DatabaseStatsJobRepository(client))
  )
  await statsJob.run({}, { reportProgress: () => {} })
  const { computedAt } = await client.characterStatsSnapshot.findUniqueOrThrow({
    where: { id: 1 }
  })
  const statsAnswer = await get('/stats')
  assert.equal(statsAnswer.computedAt, computedAt.toISOString())
  assert.equal(statsAnswer.total, after.total)
  assert.deepEqual(
    statsAnswer.jobs
      .filter((job) => job.jobId === jobId)
      .map(({ jobGrowId, averageFame }) => [jobGrowId, averageFame]),
    [
      ['grow-b', 70000],
      ['grow-a', 80000]
    ]
  )
  // 요청은 계산하지 않으므로 저장 뒤 더한 캐릭터는 다음 job 실행 전까지 응답에 들지 않는다.
  await recordCharacterBasic(client, basic('cain', 'rank-after-snapshot', 'grow-a', 90000))
  assert.deepEqual(await get('/stats'), statsAnswer)

  // 두 세트를 낀 캐릭터 105명이다. 99~102위가 같은 명성이고 서버가 번갈아, 100위와 101위 사이 page 경계가 같은 명성의 서버 순서에 걸린다.
  const fairy = { id: 'set-rank-fairy', name: '소울 페어리 세트' }
  const golden = { id: 'set-rank-golden', name: '영원히 이어지는 황금향 세트' }
  const dragon = (option) => ({ id: 16204, name: '야망의 용투 서약', option })
  const setCharacters = Array.from({ length: 105 }, (_, index) => {
    const serverId = index % 2 === 0 ? 'cain' : 'siroco'
    const characterId = `set-rank-${String(index).padStart(3, '0')}`
    const fame = 160000 - (index >= 98 && index <= 101 ? 98 : index)
    const jobGrowId = index === 0 ? 'grow-set-other' : 'grow-set'
    const option = index % 3 === 0 ? '용투 : 세계를 태우는 불꽃' : '용투 : 합성 선택지'

    // 모두 같은 무기를 끼고, 짝수 번째만 같은 유일 장비 반지를 낀다.
    const items = [
      {
        slotId: 'WEAPON',
        itemId: 'item-rank-weapon',
        itemName: '합성 랭킹 무기',
        typeDetail: '도'
      },
      ...(index % 2 === 0
        ? [
            {
              slotId: 'RING',
              itemId: 'item-rank-ring',
              itemName: '합성 랭킹 반지',
              typeDetail: '반지'
            }
          ]
        : [])
    ]

    return { serverId, characterId, fame, jobGrowId, option, items }
  })
  const setFilteredJob = 'synthetic-set-rank-job'

  for (const { serverId, characterId, fame, jobGrowId, option, items } of setCharacters) {
    await recordCharacterBasic(
      client,
      basic(serverId, characterId, jobGrowId, fame, setFilteredJob)
    )
    await recordCharacterSets(client, {
      serverId,
      characterId,
      equipmentSet: fairy,
      oathSet: dragon(option),
      items,
      fetchedAt: new Date()
    })
  }

  for (const [characterId, equipmentSet, oathSet] of [
    ['set-rank-fairy-only', fairy, null],
    ['set-rank-golden', golden, dragon('용투 : 세계를 태우는 불꽃')]
  ]) {
    await recordCharacterBasic(
      client,
      basic('cain', characterId, 'grow-set', 170000, setFilteredJob)
    )
    await recordCharacterSets(client, {
      serverId: 'cain',
      characterId,
      equipmentSet,
      oathSet,
      items: [],
      fetchedAt: new Date()
    })
  }

  const expectedOrder = setCharacters
    .toSorted(
      (left, right) =>
        right.fame - left.fame ||
        left.serverId.localeCompare(right.serverId) ||
        left.characterId.localeCompare(right.characterId)
    )
    .map(({ characterId }) => characterId)
  const readAllPages = async (query) => {
    const pages = []
    let cursor = null

    do {
      const page = await get(
        `/rankings/fame?${query}${cursor !== null ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      )
      pages.push(page)
      cursor = page.nextCursor
    } while (cursor !== null)

    return pages
  }
  const bothSetsQuery = `jobId=${setFilteredJob}&equipmentSetId=${fairy.id}&oathSetId=16204`
  const bothSetsPages = await readAllPages(bothSetsQuery)
  const bothSetsRows = bothSetsPages.flatMap(({ characters }) => characters)
  assert.deepEqual(
    bothSetsPages.map(({ characters }) => characters.length),
    [100, 5]
  )
  assert.deepEqual(
    bothSetsRows.map(({ characterId }) => characterId),
    expectedOrder
  )
  const [lastOfFirstPage, firstOfSecondPage] = bothSetsRows.slice(99, 101)
  assert.equal(lastOfFirstPage.fame, firstOfSecondPage.fame)
  assert.notEqual(lastOfFirstPage.serverId, firstOfSecondPage.serverId)
  assert.deepEqual(
    bothSetsRows.map(({ rank }) => rank),
    Array.from({ length: 105 }, (_, index) => index + 1)
  )
  assert.deepEqual(bothSetsRows[0].equipmentSet, fairy)
  assert.deepEqual(bothSetsRows[0].oathSet, dragon('용투 : 세계를 태우는 불꽃'))

  const growPages = await readAllPages(`${bothSetsQuery}&jobGrowId=grow-set-other`)
  assert.deepEqual(
    growPages.flatMap(({ characters }) => characters.map(({ characterId }) => characterId)),
    ['set-rank-000']
  )
  const optionRows = (
    await readAllPages(
      `${bothSetsQuery}&oathSetOption=${encodeURIComponent('용투 : 세계를 태우는 불꽃')}`
    )
  ).flatMap(({ characters }) => characters)
  assert.equal(optionRows.length, 35)
  assert.ok(optionRows.every(({ oathSet }) => oathSet.option === '용투 : 세계를 태우는 불꽃'))
  const equipmentRows = (
    await readAllPages(`jobId=${setFilteredJob}&equipmentSetId=${fairy.id}`)
  ).flatMap(({ characters }) => characters)
  assert.deepEqual(
    equipmentRows.slice(0, 2).map(({ characterId, oathSet }) => [characterId, oathSet]),
    [
      ['set-rank-fairy-only', null],
      ['set-rank-000', dragon('용투 : 세계를 태우는 불꽃')]
    ]
  )
  assert.equal(equipmentRows.length, 106)

  const weaponPages = await readAllPages(`jobId=${setFilteredJob}&itemIds=item-rank-weapon`)
  const weaponRows = weaponPages.flatMap(({ characters }) => characters)
  assert.deepEqual(
    weaponPages.map(({ characters }) => characters.length),
    [100, 5]
  )
  assert.deepEqual(
    weaponRows.map(({ characterId }) => characterId),
    expectedOrder
  )
  assert.deepEqual(
    weaponRows.map(({ rank }) => rank),
    Array.from({ length: 105 }, (_, index) => index + 1)
  )

  const ringHolders = setCharacters
    .filter((_, index) => index % 2 === 0)
    .map(({ characterId }) => characterId)
  const bothItemRows = (
    await readAllPages(`jobId=${setFilteredJob}&itemIds=item-rank-weapon,item-rank-ring`)
  ).flatMap(({ characters }) => characters)
  assert.deepEqual(
    bothItemRows.map(({ characterId }) => characterId),
    expectedOrder.filter((characterId) => ringHolders.includes(characterId))
  )

  const filteredItemRows = (
    await readAllPages(`${bothSetsQuery}&jobGrowId=grow-set-other&itemIds=item-rank-ring`)
  ).flatMap(({ characters }) => characters)
  assert.deepEqual(
    filteredItemRows.map(({ characterId }) => characterId),
    ['set-rank-000']
  )
  assert.deepEqual(await get(`/rankings/fame?itemIds=item-rank-nobody`), {
    characters: [],
    nextCursor: null
  })

  // 1만 명이 낀 아이템은 먼저 모으지 않고 명성 index를 따라 읽는 분기를 탄다. 행을 SQL로 한 번에 넣는다.
  const commonJob = 'synthetic-common-item-job'
  await client.$executeRaw`
    INSERT INTO characters
      (server_id, character_id, character_name, adventure_id, level, job_id, job_grow_id, job_name, job_grow_name, fame, sets_fetched_at)
    SELECT 'cain', 'common-' || g, '합성common' || g, (SELECT id FROM adventures ORDER BY id LIMIT 1), 115,
      ${commonJob}, 'grow-common', '합성직업', '합성전직', 10000 + g / 2, now()
    FROM generate_series(1, 10000) g`
  await client.$executeRaw`
    INSERT INTO character_items (server_id, character_id, slot_id, item_id, item_name)
    SELECT 'cain', 'common-' || g, 'WEAPON', 'item-rank-common', '합성 흔한 무기'
    FROM generate_series(1, 10000) g`
  const commonExpected = (
    await client.$queryRaw`
      SELECT character_id AS "characterId" FROM characters
      WHERE job_id = ${commonJob}
      ORDER BY fame DESC, server_id, character_id
      LIMIT 200`
  ).map(({ characterId }) => characterId)
  const commonFirst = await get(`/rankings/fame?jobId=${commonJob}&itemIds=item-rank-common`)
  const commonSecond = await get(
    `/rankings/fame?jobId=${commonJob}&itemIds=item-rank-common&cursor=${encodeURIComponent(commonFirst.nextCursor)}`
  )
  assert.deepEqual(
    [...commonFirst.characters, ...commonSecond.characters].map(({ characterId }) => characterId),
    commonExpected
  )
  assert.deepEqual(
    [...commonFirst.characters, ...commonSecond.characters].map(({ rank }) => rank),
    Array.from({ length: 200 }, (_, index) => index + 1)
  )
  assert.equal(typeof commonSecond.nextCursor, 'string')
} finally {
  await client.$disconnect()
}
