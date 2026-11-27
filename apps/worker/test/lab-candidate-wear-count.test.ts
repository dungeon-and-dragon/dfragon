import assert from 'node:assert/strict'
import test from 'node:test'
import { createLabCandidateWearCountJob } from '../src/application/lab-candidates/index.js'

// 착용 수를 세는 SQL은 @dfragon/database의 테스트가 확인하고, 여기서는 교체를 fake로 둔다.
const now = new Date('2026-11-28T15:30:00.000Z')

test('실험실 후보 착용 수 job은 실행 시각으로 착용 수를 바꾸고 넣은 이름 수를 요약에 남긴다', async () => {
  const computedAts: Date[] = []
  const job = createLabCandidateWearCountJob(
    {
      replaceWearCounts: async (computedAt) => {
        computedAts.push(computedAt)

        return 2599
      }
    },
    () => now
  )

  const summary = await job.run({}, { reportProgress: () => undefined })

  assert.deepEqual(summary, { names: 2599 })
  assert.deepEqual(computedAts, [now])
})

test('실험실 후보 착용 수 job은 매일 00:30에 돌고 Neople API를 쓰지 않는다', () => {
  const job = createLabCandidateWearCountJob({ replaceWearCounts: async () => 0 })

  assert.equal(job.name, 'lab-candidate-wear-count')
  assert.equal(job.displayName, '실험실 후보 착용 수')
  assert.equal(job.schedule, '30 0 * * *')
  assert.equal(job.neopleApi, null)
})
