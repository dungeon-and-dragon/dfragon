// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { RANKING_JOBS } from '#entities/character'
import {
  parseJobSearch,
  parseRankingSearch,
  rankingFilterOf,
  rankingSearchOf
} from './ranking-search'

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

it('세트 통계 막대에서 넘어온 장비 세트, 서약 세트, 선택지를 직업과 함께 읽는다', () => {
  expect(
    parseRankingSearch({
      jobId: job.jobId,
      equipmentSetId: '7f788a703a87d783079b41d0fe6448c9',
      oathSetId: '16204',
      oathSetOption: '용투 : 용제 강림'
    })
  ).toEqual({
    jobId: job.jobId,
    equipmentSetId: '7f788a703a87d783079b41d0fe6448c9',
    oathSetId: 16204,
    oathSetOption: '용투 : 용제 강림'
  })
  expect(parseRankingSearch({ equipmentSetId: 'set-1' })).toEqual({ equipmentSetId: 'set-1' })
})

it('서약 세트 없는 선택지와 읽을 수 없는 서약 세트 번호는 버린다', () => {
  expect(parseRankingSearch({ oathSetOption: '용투 : 용제 강림' })).toEqual({})
  expect(parseRankingSearch({ oathSetId: 'abc', oathSetOption: '용투 : 용제 강림' })).toEqual({})
  expect(parseRankingSearch({ equipmentSetId: '' })).toEqual({})
})

it('세트 통계 주소는 직업, 전직, 역할만 읽고 세트 값은 버린다', () => {
  expect(
    parseJobSearch({ jobId: job.jobId, jobGrowId: grow.jobGrowId, equipmentSetId: 'set-1' })
  ).toEqual({ jobId: job.jobId, jobGrowId: grow.jobGrowId })
})

it('itemIds는 쉼표로 이은 값을 읽어 빈 항목과 중복을 버리고, 여섯 개 이상이면 아이템 필터를 버린다', () => {
  expect(parseRankingSearch({ itemIds: 'weapon-1,ring-1' })).toEqual({ itemIds: 'weapon-1,ring-1' })
  expect(parseRankingSearch({ itemIds: 'weapon-1,,weapon-1' })).toEqual({ itemIds: 'weapon-1' })
  expect(parseRankingSearch({ itemIds: '' })).toEqual({})
  expect(parseRankingSearch({ itemIds: 'a,b,c,d,e,f' })).toEqual({})
  expect(parseRankingSearch({ itemIds: 12345 })).toEqual({ itemIds: '12345' })
})

it('주소의 itemIds와 랭킹 필터의 itemId 목록을 서로 바꾼다', () => {
  expect(rankingFilterOf({ jobId: job.jobId, itemIds: 'weapon-1,ring-1' })).toEqual({
    jobId: job.jobId,
    itemIds: ['weapon-1', 'ring-1']
  })
  expect(rankingSearchOf({ jobId: job.jobId, itemIds: ['weapon-1', 'ring-1'] })).toEqual({
    jobId: job.jobId,
    itemIds: 'weapon-1,ring-1'
  })
  expect(rankingSearchOf({ itemIds: [] })).toEqual({})
})

it('명성 범위는 router가 읽은 0 이상의 정수만 받고, 거꾸로 된 범위와 빈 값, 10자리 이상은 버린다', () => {
  expect(parseRankingSearch({ fameFrom: 136000, fameTo: 138000 })).toEqual({
    fameFrom: 136000,
    fameTo: 138000
  })
  expect(parseRankingSearch({ fameFrom: 0 })).toEqual({ fameFrom: 0 })
  expect(parseRankingSearch({ fameTo: 138000 })).toEqual({ fameTo: 138000 })
  expect(parseRankingSearch({ fameFrom: 138000, fameTo: 136000 })).toEqual({})
  expect(parseRankingSearch({ fameFrom: '', fameTo: 1.5 })).toEqual({})
  expect(parseRankingSearch({ fameTo: 1_000_000_000 })).toEqual({})
})

it('evolutions는 전직을 고른 주소에서만 읽고, 형식이 틀린 쌍, 같은 스킬 중복, 여섯 쌍 이상이 있으면 개화 필터를 버린다', () => {
  const growSearch = { jobId: job.jobId, jobGrowId: grow.jobGrowId }

  expect(parseRankingSearch({ ...growSearch, evolutions: '발도~1,환영검무~2' })).toEqual({
    ...growSearch,
    evolutions: '발도~1,환영검무~2'
  })
  expect(parseRankingSearch({ jobId: job.jobId, evolutions: '발도~1' })).toEqual({
    jobId: job.jobId
  })
  expect(
    ['발도~3', '발도', '~1', '발도~1,발도~2', '가~1,나~1,다~1,라~1,마~1,바~1', ''].map(
      (evolutions) => parseRankingSearch({ ...growSearch, evolutions })
    )
  ).toEqual(Array.from({ length: 6 }, () => growSearch))
})

it('주소의 evolutions와 랭킹 필터의 개화 목록을 서로 바꾸고, 빈 목록은 주소에 남기지 않는다', () => {
  const growFilter = { jobId: job.jobId, jobGrowId: grow.jobGrowId }
  const evolutions = [
    { name: '발도', type: 1 },
    { name: '차지 버스트', type: 2 }
  ] as const

  expect(rankingFilterOf({ ...growFilter, evolutions: '발도~1,차지 버스트~2' })).toEqual({
    ...growFilter,
    evolutions
  })
  expect(rankingSearchOf({ ...growFilter, evolutions })).toEqual({
    ...growFilter,
    evolutions: '발도~1,차지 버스트~2'
  })
  expect(rankingSearchOf({ ...growFilter, evolutions: [] })).toEqual(growFilter)
})

it('검색 기준이 점수면 점수 범위만, 명성이면 명성 범위만 읽고, 모르는 기준과 거꾸로 된 점수 범위는 버린다', () => {
  expect(
    parseRankingSearch({
      sort: 'equipmentScore',
      scoreFrom: 1300000,
      scoreTo: 1400000,
      fameFrom: 136000
    })
  ).toEqual({ sort: 'equipmentScore', scoreFrom: 1300000, scoreTo: 1400000 })
  expect(parseRankingSearch({ fameFrom: 136000, scoreFrom: 1300000 })).toEqual({
    fameFrom: 136000
  })
  expect(parseRankingSearch({ sort: 'fame', fameTo: 138000 })).toEqual({ fameTo: 138000 })
  expect(parseRankingSearch({ sort: 'buffScore', scoreFrom: 240000, scoreTo: 200000 })).toEqual({
    sort: 'buffScore'
  })
})
