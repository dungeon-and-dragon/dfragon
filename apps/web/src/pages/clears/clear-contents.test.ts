import { expect, it } from 'vitest'
import type { ClearContent, ClearJob } from '#core/ranking/clear-stats'
import { contentRows, findSelectedContent, jobRows, ratioLabel } from './clear-contents'

function content(id: string, kind: ClearContent['kind'], latest: boolean): ClearContent {
  return {
    id,
    kind,
    name: id,
    releasedAt: '2026-08-05T21:00:00.000Z',
    entryFame: 104292,
    latest,
    weeks: []
  }
}

const contents = [
  content('nabel-normal', 'raid', false),
  content('nabel-hard', 'raid', false),
  content('michaela-normal', 'raid', true),
  content('michaela-hard', 'raid', true),
  content('nightmare', 'challenge', true)
]

it('최신 레이드, 최신 챌린지, 지난 컨텐츠 줄로 나누고 줄마다 최근 컨텐츠와 하드를 앞에 둔다', () => {
  expect(
    contentRows(contents).map(({ label, contents: row }) => [label, row.map(({ id }) => id)])
  ).toEqual([
    ['레이드', ['michaela-hard', 'michaela-normal']],
    ['챌린지', ['nightmare']],
    ['지난 컨텐츠', ['nabel-hard', 'nabel-normal']]
  ])
})

it('컨텐츠가 없는 줄은 두지 않는다', () => {
  expect(contentRows([content('nightmare', 'challenge', true)]).map(({ label }) => label)).toEqual([
    '챌린지'
  ])
})

it('주소의 컨텐츠를 고르고, 없거나 모르는 컨텐츠면 첫 최신 레이드를 고른다', () => {
  expect(findSelectedContent(contents, 'nabel-normal')?.id).toBe('nabel-normal')
  expect(findSelectedContent(contents, 'unknown')?.id).toBe('michaela-hard')
  expect(findSelectedContent(contents, undefined)?.id).toBe('michaela-hard')
})

it('배율은 100에 더한 퍼센트로 쓰고 배율 없는 클리어는 기본으로 쓴다', () => {
  expect([null, 50, 500].map(ratioLabel)).toEqual(['기본', '150%', '600%'])
})

function job(name: string | null, population: number, cleared: number): ClearJob {
  return {
    jobId: name,
    jobGrowId: name,
    jobName: name,
    jobGrowName: name,
    population,
    cleared
  }
}

const jobs = [
  job('전직1', 100, 10),
  job('전직2', 10, 5),
  job(null, 0, 3),
  job('전직3', 50, 10),
  job('전직4', 100, 20)
]

it('직업은 클리어율 순으로 두고 같으면 클리어가 많은 쪽을 앞에 두며 모집단이 없는 전직은 맨 뒤에 둔다', () => {
  expect(jobRows(jobs, 'rate').map(({ name, rate }) => [name, rate])).toEqual([
    ['전직2', 0.5],
    ['전직4', 0.2],
    ['전직3', 0.2],
    ['전직1', 0.1],
    ['알 수 없음', null]
  ])
})

it('클리어 순 정렬은 클리어 수가 많은 순이다', () => {
  expect(jobRows(jobs, 'cleared').map(({ cleared }) => cleared)).toEqual([20, 10, 10, 5, 3])
})
