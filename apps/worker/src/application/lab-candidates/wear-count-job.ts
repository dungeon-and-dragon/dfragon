import { z } from 'zod'
import { defineJob } from '#application/jobs/index.js'
import type { LabCandidateWearCountRepository } from './repository.js'

// 세트를 받은 합성 캐릭터 100만 명(아이템 380만 행, PostgreSQL 18)에서 약 0.6초 걸렸다. 다른 집계 job처럼 넉넉히 둔다.
const DELAY_MINUTES = 5

export function createLabCandidateWearCountJob(
  repository: LabCandidateWearCountRepository,
  now: () => Date = () => new Date()
) {
  return defineJob({
    name: 'lab-candidate-wear-count',
    displayName: '실험실 후보 착용 수',
    description:
      '세트 값을 받은 캐릭터가 낀 칭호, 오라, 크리쳐를 이름별로 세어 실험실 후보의 착용 수를 바꿉니다.',
    schedule: '30 0 * * *',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    neopleApi: null,
    run: async () => {
      const names = await repository.replaceWearCounts(now())

      return { names }
    }
  })
}
