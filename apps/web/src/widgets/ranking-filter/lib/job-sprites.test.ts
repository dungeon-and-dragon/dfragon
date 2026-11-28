import { expect, it } from 'vitest'
import { RANKING_JOBS } from '#entities/character'
import { growSprite, jobSprite } from './job-sprites'

it('검색 목록의 모든 전직에 썸네일 칸이 있다', () => {
  const missing = RANKING_JOBS.flatMap((job) =>
    job.grows
      .filter((grow) => growSprite(job, grow) === undefined)
      .map((grow) => `${job.name}/${grow.name}`)
  )

  expect(missing).toEqual([])
})

it('검색 목록의 모든 직업에 썸네일 칸이 있다', () => {
  const missing = RANKING_JOBS.filter((job) => jobSprite(job) === undefined).map(({ name }) => name)

  expect(missing).toEqual([])
})
