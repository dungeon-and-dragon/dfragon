import { expect, it } from 'vitest'
import { RANKING_JOBS } from './ranking-jobs'
import { parseRankingSearch } from './ranking-search'

const [job, otherJob] = RANKING_JOBS
const grow = job.grows[0]

it('목록에 있는 직업과 그 직업의 전직을 그대로 읽는다', () => {
  expect(parseRankingSearch({ jobId: job.jobId, jobGrowId: grow.jobGrowId })).toEqual({
    jobId: job.jobId,
    jobGrowId: grow.jobGrowId
  })
  expect(parseRankingSearch({ jobId: job.jobId })).toEqual({ jobId: job.jobId })
  expect(parseRankingSearch({})).toEqual({})
})

it('제국기사 jobId를 읽어 필터를 유지한다', () => {
  const jobId = '8d4d2001cdb357e41633c234eb7501b5'

  expect(parseRankingSearch({ jobId })).toEqual({ jobId })
})

it('목록에 없는 직업이나 다른 직업의 전직, 직업 없는 전직은 버린다', () => {
  expect(parseRankingSearch({ jobId: 'unknown', jobGrowId: grow.jobGrowId })).toEqual({})
  expect(parseRankingSearch({ jobGrowId: grow.jobGrowId })).toEqual({})
  expect(parseRankingSearch({ jobId: job.jobId, jobGrowId: 'unknown' })).toEqual({
    jobId: job.jobId
  })
  expect(parseRankingSearch({ jobId: 7, jobGrowId: [grow.jobGrowId] })).toEqual({})
})

it('같은 id의 전직이 여러 직업에 있어도 고른 직업의 전직만 인정한다', () => {
  const sharedId = otherJob.grows.find((candidate) =>
    RANKING_JOBS.some(
      (rest) => rest !== otherJob && rest.grows.some((g) => g.jobGrowId === candidate.jobGrowId)
    )
  )?.jobGrowId

  expect(sharedId).toBeDefined()
  expect(parseRankingSearch({ jobId: otherJob.jobId, jobGrowId: sharedId })).toEqual({
    jobId: otherJob.jobId,
    jobGrowId: sharedId
  })
})

const MALE_PRIEST = 'f6a4ad30555b99b499c07835f87ce522'
const FEMALE_PRIEST = '0c1b401bb09241570d364420b3ba3fd7'
const CRUSADER = '37495b941da3b1661bc900e68ef3b2c6'
const INFIGHTER = '618326026de1a1f1cfba5dbd0b8396e7'

it('남성 크루세이더는 딜러, 버퍼 역할까지 읽는다', () => {
  expect(parseRankingSearch({ jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'dealer' })).toEqual({
    jobId: MALE_PRIEST,
    jobGrowId: CRUSADER,
    role: 'dealer'
  })
  expect(parseRankingSearch({ jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'buffer' })).toEqual({
    jobId: MALE_PRIEST,
    jobGrowId: CRUSADER,
    role: 'buffer'
  })
})

it('남성 크루세이더가 아닌 전직에 붙은 역할은 버리고 전직 랭킹을 연다', () => {
  expect(parseRankingSearch({ jobId: MALE_PRIEST, jobGrowId: INFIGHTER, role: 'dealer' })).toEqual({
    jobId: MALE_PRIEST,
    jobGrowId: INFIGHTER
  })
  expect(parseRankingSearch({ jobId: FEMALE_PRIEST, jobGrowId: CRUSADER, role: 'buffer' })).toEqual(
    {
      jobId: FEMALE_PRIEST,
      jobGrowId: CRUSADER
    }
  )
  expect(parseRankingSearch({ jobId: MALE_PRIEST, role: 'dealer' })).toEqual({ jobId: MALE_PRIEST })
})

it('남성 크루세이더의 역할이 없거나 모르는 값이면 칩이 없는 전직이라 직업 랭킹을 연다', () => {
  expect(parseRankingSearch({ jobId: MALE_PRIEST, jobGrowId: CRUSADER })).toEqual({
    jobId: MALE_PRIEST
  })
  expect(parseRankingSearch({ jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'synergy' })).toEqual({
    jobId: MALE_PRIEST
  })
  expect(parseRankingSearch({ jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: ['dealer'] })).toEqual(
    { jobId: MALE_PRIEST }
  )
})
