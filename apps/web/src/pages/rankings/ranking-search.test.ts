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
