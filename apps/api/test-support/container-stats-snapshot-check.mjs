import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readCharacterStats,
  readDatabaseConfiguration,
  readFamedJobGrows,
  readJobSkillAdoption,
  recordCharacterBasic,
  recordCharacterSkillStyle
} from '@dfragon/database'
import { roundAverageFame } from './dist/ranking-stats/service.js'
import {
  createCharacterStatsJob,
  createDatabaseStatsJobStore,
  createSkillAdoptionJob
} from './dist/ranking-stats/stats-jobs.js'

// 합성 캐릭터다. 앞 단계가 넣은 행도 있어, 저장분은 같은 DB에서 바로 계산한 값과 비교한다.
// Neople /df/jobs의 프리스트(남)와 眞 크루세이더 ID다.
const maleCrusader = {
  jobId: 'f6a4ad30555b99b499c07835f87ce522',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
}
const vanishingJob = { jobId: 'synthetic-snapshot-job', jobGrowId: 'synthetic-snapshot-grow' }
const fetchedAt = new Date('2026-11-07T00:00:00Z')
const basic = (characterId, job, fame) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성저장모험단',
  level: 115,
  ...job,
  jobName: '합성직업',
  jobGrowName: '합성전직',
  fame,
  guildId: null,
  guildName: null
})
const style = (characterId, job, skills) => ({
  serverId: 'cain',
  characterId,
  ...job,
  skills,
  evolutions: [],
  enhancements: [],
  fetchedAt
})
const withoutComputedAt = ({ computedAt: _computedAt, ...values }) => values
const ignoreProgress = { reportProgress: () => {} }

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  for (const [characterId, fame, skills] of [
    ['snapshot-dealer', 90000, [{ name: '용기의 은총', level: 1 }]],
    ['snapshot-buffer', 89000, [{ name: '합성버프', level: 20 }]]
  ]) {
    await recordCharacterBasic(client, basic(characterId, maleCrusader, fame))
    await recordCharacterSkillStyle(client, style(characterId, maleCrusader, skills))
  }
  await recordCharacterBasic(client, basic('snapshot-vanishing', vanishingJob, 50000))
  await recordCharacterSkillStyle(
    client,
    style('snapshot-vanishing', vanishingJob, [{ name: '합성소멸', level: 1 }])
  )

  const store = createDatabaseStatsJobStore(client)
  const statsJob = createCharacterStatsJob(store)
  const skillJob = createSkillAdoptionJob(store)
  const readStoredStats = async () => {
    const { id: _id, ...stored } = await client.characterStatsSnapshot.findUniqueOrThrow({
      where: { id: 1 }
    })

    return stored
  }
  const readStoredAdoption = () =>
    client.jobSkillAdoptionSnapshot.findMany({
      orderBy: [{ jobId: 'asc' }, { jobGrowId: 'asc' }, { role: 'asc' }]
    })
  const assertAdoptionMatchesComputed = async (rows) => {
    for (const { jobId, jobGrowId, role, computedAt: _computedAt, ...stored } of rows) {
      const query = { jobId, jobGrowId, ...(role !== 'all' ? { role } : {}) }
      assert.deepEqual(
        stored,
        await readJobSkillAdoption(client, query),
        `${jobId}/${jobGrowId}/${role}`
      )
    }
  }

  const statsStartedAt = new Date()
  await statsJob.run({}, ignoreProgress)
  const storedStats = await readStoredStats()
  assert.deepEqual(
    withoutComputedAt(storedStats),
    roundAverageFame(await readCharacterStats(client))
  )
  assert.ok(storedStats.computedAt >= statsStartedAt)
  await statsJob.run({}, ignoreProgress)
  assert.equal(await client.characterStatsSnapshot.count(), 1)

  await skillJob.run({}, ignoreProgress)
  const famedJobGrows = await readFamedJobGrows(client)
  const firstRows = await readStoredAdoption()
  // 남성 크루세이더만 전체에 더해 딜러, 버퍼 행이 있다. 앞 단계의 남성 크루세이더도 표본에 든다.
  assert.equal(firstRows.length, famedJobGrows.length + 2)
  const crusaderSamples = new Map(
    firstRows
      .filter(
        ({ jobId, jobGrowId }) =>
          jobId === maleCrusader.jobId && jobGrowId === maleCrusader.jobGrowId
      )
      .map(({ role, sampleSize }) => [role, sampleSize])
  )
  assert.deepEqual([...crusaderSamples.keys()], ['all', 'buffer', 'dealer'])
  assert.equal(
    crusaderSamples.get('all'),
    crusaderSamples.get('dealer') + crusaderSamples.get('buffer')
  )
  await assertAdoptionMatchesComputed(firstRows)

  await client.$executeRaw`UPDATE characters SET fame = NULL WHERE character_id = 'snapshot-vanishing'`
  await skillJob.run({}, ignoreProgress)
  const secondRows = await readStoredAdoption()
  assert.equal(secondRows.length, firstRows.length - 1)
  assert.ok(!secondRows.some(({ jobGrowId }) => jobGrowId === vanishingJob.jobGrowId))
  assert.ok(
    secondRows.every(({ computedAt }) => firstRows.every((first) => computedAt > first.computedAt))
  )
  await assertAdoptionMatchesComputed(secondRows)
} finally {
  await client.$disconnect()
}
