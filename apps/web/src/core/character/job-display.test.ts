import { expect, it } from 'vitest'
import { displayJobName } from './job-display'

it.each([
  ['격투가(남)', '眞 넨마스터', null, '넨마스터 (남)'],
  ['격투가(여)', '眞 넨마스터', null, '넨마스터 (여)'],
  ['프리스트(남)', '眞 인파이터', null, '인파이터 (남)'],
  ['프리스트(여)', '眞 인파이터', null, '인파이터 (여)'],
  ['프리스트(남)', '眞 크루세이더', 'dealer', '크루세이더(딜러)'],
  ['프리스트(남)', '眞 크루세이더', 'buffer', '크루세이더(버퍼)'],
  ['프리스트(남)', '眞 크루세이더', null, '크루세이더 (남)'],
  ['프리스트(여)', '眞 크루세이더', 'buffer', '크루세이더 (여)'],
  ['귀검사(남)', '眞 웨펀마스터', null, '웨펀마스터'],
  ['마법사(여)', '眞 엘레멘탈마스터', null, '엘레멘탈마스터'],
  ['도적', '眞 로그', null, '로그'],
  ['도적', '眞 넨마스터', null, '넨마스터'],
  [null, '眞 넨마스터', null, '넨마스터'],
  ['격투가(여)', null, null, '격투가(여)'],
  [null, null, null, null]
] as const)('%s, %s, %s 전직 표시: %s', (jobName, jobGrowName, role, expected) => {
  expect(displayJobName({ jobName, jobGrowName }, role)).toBe(expected)
})
