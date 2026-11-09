import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readCharacterStats,
  readDatabaseConfiguration,
  readFameRanking,
  recordCharacterBasic
} from '@dfragon/database'
import {
  createCharacterStatsJob,
  createDatabaseStatsJobStore
} from './dist/ranking-stats/stats-jobs.js'

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
      dealerSkillLearned: null
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

  // 같은 컨테이너에서 DB 설정으로 뜬 API를 불러 runtime 연결과 저장분 읽기까지 확인한다.
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
  const statsJob = createCharacterStatsJob(createDatabaseStatsJobStore(client))
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
} finally {
  await client.$disconnect()
}
