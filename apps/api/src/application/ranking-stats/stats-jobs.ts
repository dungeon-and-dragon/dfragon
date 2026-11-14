import type { MaleCrusaderRole, SkillStyleSampleJob } from '@dfragon/database'
import { z } from 'zod'
import { isMaleCrusaderJob } from '../../domain/male-crusader.js'
import { roundAverageFame } from '../../domain/ranking-stats/stats.js'
import { defineJob } from '../jobs/definition.js'
import type { StatsJobRepository } from './repository.js'

const DAILY_AT_MIDNIGHT = '0 0 * * *'
// 운영 크기 합성 데이터(캐릭터 55.8만, 스킬 스타일 40.4만 행, PostgreSQL 18.6)에서 통계는 0.3초, 스킬 채택률은
// 82 전직에 22.5초 걸렸다. 운영 장비와 설정 차이를 감안해 열 배 넘게 둔다.
const CHARACTER_STATS_DELAY_MINUTES = 5
const SKILL_ADOPTION_DELAY_MINUTES = 10

function rolesOf(job: SkillStyleSampleJob): (MaleCrusaderRole | undefined)[] {
  if (isMaleCrusaderJob(job)) {
    return [undefined, 'dealer', 'buffer']
  }

  return [undefined]
}

export class StatsJobService {
  constructor(
    private readonly repository: StatsJobRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async computeCharacterStats(): Promise<{ total: number }> {
    const computedAt = this.now()
    const stats = roundAverageFame(await this.repository.readCharacterStats())
    await this.repository.saveCharacterStats({ ...stats, computedAt })

    return { total: stats.total }
  }

  async computeSkillAdoption(
    reportProgress: (done: number, total: number) => void
  ): Promise<{ jobGrows: number; deleted: number }> {
    const startedAt = this.now()
    const jobGrows = await this.repository.readFamedJobGrows()
    reportProgress(0, jobGrows.length)
    for (const [index, jobGrow] of jobGrows.entries()) {
      for (const role of rolesOf(jobGrow)) {
        const computedAt = this.now()
        const adoption = await this.repository.readJobSkillAdoption({ ...jobGrow, role })
        await this.repository.saveJobSkillAdoption({ ...jobGrow, role, computedAt, adoption })
      }
      reportProgress(index + 1, jobGrows.length)
    }
    // 이번 실행이 저장한 행은 시작 시각 이후에 계산했으므로, 남은 것은 명성 있는 캐릭터가 없어진 전직의 행이다.
    const deleted = await this.repository.deleteJobSkillAdoptionComputedBefore(startedAt)

    return { jobGrows: jobGrows.length, deleted }
  }
}

export function createCharacterStatsJob(service: StatsJobService) {
  return defineJob({
    name: 'character-stats',
    displayName: '통계',
    description: '통계 화면에 쓰는 집계를 계산해 저장합니다.',
    schedule: DAILY_AT_MIDNIGHT,
    argsSchema: z.object({}),
    delayMinutes: CHARACTER_STATS_DELAY_MINUTES,
    run: () => service.computeCharacterStats()
  })
}

export function createSkillAdoptionJob(service: StatsJobService) {
  return defineJob({
    name: 'skill-adoption',
    displayName: '스킬 채택률',
    description: '전직별 스킬 채택률을 계산해 저장합니다.',
    schedule: DAILY_AT_MIDNIGHT,
    argsSchema: z.object({}),
    delayMinutes: SKILL_ADOPTION_DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.computeSkillAdoption(reportProgress)
  })
}
