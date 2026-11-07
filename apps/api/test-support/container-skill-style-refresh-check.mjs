import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  deleteCharacterSkillStyle,
  readDatabaseConfiguration,
  readSkillStyleSampleJobs,
  recordCharacterBasic,
  recordCharacterBasicAndSkillStyle,
  recordCharacterSkillStyle,
  takeSkillStyleRefreshBatch
} from '@dfragon/database'

// 합성 캐릭터다. 한 전직에 명성이 다른 21명을 두어 percent_rank가 0, 0.05, 0.1인 앞 세 명만 상위 10%에 든다.
const job = { jobId: 'synthetic-refresh-job', jobGrowId: 'synthetic-refresh-grow' }
const otherJob = { jobId: 'synthetic-refresh-other', jobGrowId: 'synthetic-refresh-grow' }
const noFameJob = { jobId: 'synthetic-refresh-no-fame', jobGrowId: 'synthetic-refresh-grow' }
const now = new Date('2026-11-08T00:00:00Z')
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
const basic = (characterId, fame, { jobId, jobGrowId } = job) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성갱신모험단',
  level: 115,
  jobId,
  jobGrowId,
  jobName: '합성직업',
  jobGrowName: '합성전직',
  fame,
  guildId: null,
  guildName: null
})
const style = (characterId, fetchedAt, skill = '합성스킬') => ({
  serverId: 'cain',
  characterId,
  ...job,
  skills: [{ name: skill, level: 13 }],
  evolutions: [],
  enhancements: [{ name: skill, type: 1 }],
  fetchedAt
})
const refreshId = (index) => `refresh-${String(index).padStart(2, '0')}`
const ids = (rows) => rows.map(({ characterId }) => characterId)

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  for (let index = 0; index <= 20; index++) {
    await recordCharacterBasic(client, basic(refreshId(index), 100_000 - index))
  }
  await recordCharacterBasic(client, basic('refresh-no-fame', null))
  await recordCharacterBasic(client, basic('refresh-other-job', 200_000, otherJob))
  await recordCharacterBasic(client, basic('refresh-no-fame-job', null, noFameJob))
  // 8일 전에 받은 행은 갱신 대상이고, 6일 전에 받은 행은 아직 대상이 아니다.
  await recordCharacterSkillStyle(client, style(refreshId(0), daysAgo(8)))
  await recordCharacterSkillStyle(client, style(refreshId(1), daysAgo(6)))

  const jobs = await readSkillStyleSampleJobs(client)
  assert.ok(jobs.some((row) => row.jobId === job.jobId && row.jobGrowId === job.jobGrowId))
  assert.ok(jobs.some((row) => row.jobId === otherJob.jobId))
  assert.ok(!jobs.some((row) => row.jobId === noFameJob.jobId))

  // 받은 적 없는 캐릭터가 먼저이고, 상위 10% 밖, 명성 없는 캐릭터와 다른 전직은 고르지 않는다.
  assert.deepEqual(ids(await takeSkillStyleRefreshBatch(client, job, [], 100, now)), [
    refreshId(2),
    refreshId(0)
  ])
  assert.deepEqual(ids(await takeSkillStyleRefreshBatch(client, job, [], 1, now)), [refreshId(2)])
  assert.deepEqual(
    ids(
      await takeSkillStyleRefreshBatch(
        client,
        job,
        [{ serverId: 'cain', characterId: refreshId(2) }],
        100,
        now
      )
    ),
    [refreshId(0)]
  )

  // 기본 정보와 스킬 스타일은 한 transaction이라, 스킬 스타일을 쓰지 못하면 바뀐 명성도 남지 않는다.
  await assert.rejects(
    recordCharacterBasicAndSkillStyle(
      client,
      basic(refreshId(2), 1),
      style(refreshId(2), new Date(Number.NaN))
    )
  )
  const unchanged = await client.character.findUnique({
    where: { serverId_characterId: { serverId: 'cain', characterId: refreshId(2) } },
    select: { fame: true }
  })
  assert.equal(unchanged?.fame, 99_998)

  await recordCharacterBasicAndSkillStyle(
    client,
    basic(refreshId(2), 100_500),
    style(refreshId(2), now, '갱신스킬')
  )
  const refreshed = await client.character.findUnique({
    where: { serverId_characterId: { serverId: 'cain', characterId: refreshId(2) } },
    select: { fame: true, skillStyle: { select: { skills: true, fetchedAt: true } } }
  })
  assert.deepEqual(refreshed, {
    fame: 100_500,
    skillStyle: { skills: [{ name: '갱신스킬', level: 13 }], fetchedAt: now }
  })
  assert.deepEqual(ids(await takeSkillStyleRefreshBatch(client, job, [], 100, now)), [refreshId(0)])

  await deleteCharacterSkillStyle(client, { serverId: 'cain', characterId: refreshId(0) })
  assert.equal(
    await client.characterSkillStyle.count({
      where: { serverId: 'cain', characterId: refreshId(0) }
    }),
    0
  )
  assert.equal(
    await client.character.count({ where: { serverId: 'cain', characterId: refreshId(0) } }),
    1
  )
} finally {
  await client.$disconnect()
}
