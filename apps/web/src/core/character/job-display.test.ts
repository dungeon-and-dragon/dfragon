import { expect, it } from 'vitest'
import { displayJobName, jobLabelOf } from './job-display'

it.each([
  ['격투가(남)', '眞 넨마스터', null, '넨마스터 격투가(남)'],
  ['격투가(여)', '眞 넨마스터', null, '넨마스터 격투가(여)'],
  ['프리스트(남)', '眞 크루세이더', 'dealer', '크루세이더(딜러) 프리스트(남)'],
  ['프리스트(남)', '眞 크루세이더', 'buffer', '크루세이더(버퍼) 프리스트(남)'],
  ['프리스트(남)', '眞 크루세이더', null, '크루세이더 프리스트(남)'],
  ['프리스트(여)', '眞 크루세이더', 'buffer', '크루세이더 프리스트(여)'],
  ['마법사(여)', '眞 엘레멘탈마스터', null, '엘레멘탈마스터 마법사(여)'],
  ['마법사(여)', '엘레멘탈마스터', null, '엘레멘탈마스터 마법사(여)'],
  ['도적', '眞 로그', null, '로그 도적'],
  ['다크나이트', '眞 다크나이트', null, '다크나이트'],
  [null, '眞 넨마스터', null, '넨마스터'],
  ['격투가(여)', null, null, '격투가(여)'],
  [null, null, null, null]
] as const)('%s, %s, %s 전직 표시: %s', (jobName, jobGrowName, role, expected) => {
  expect(displayJobName({ jobName, jobGrowName }, role)).toBe(expected)
})

it('전직 이름과 직업 이름을 나눠 직업 이름을 보조 글자로 그릴 수 있게 한다', () => {
  expect(jobLabelOf({ jobName: '마법사(여)', jobGrowName: '眞 엘레멘탈마스터' })).toEqual({
    grow: '엘레멘탈마스터',
    job: '마법사(여)'
  })
})
