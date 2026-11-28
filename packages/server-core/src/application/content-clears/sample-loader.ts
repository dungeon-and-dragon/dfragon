import type {
  ClearContentWeekSamples,
  ClearOverviewWeekSamples,
  ClearWeekComparison,
  StoredClearPopulation
} from '@dfragon/database'
import { subWeeks } from 'date-fns'
import { toRaidStageLabel } from '#domain/raid-stage.js'
import {
  type ClearContent,
  findStagePair,
  hasScoreStats,
  toCollectionMinFame,
  toPopulationMinFame
} from '#domain/content-clears/index.js'
import type { ClearSampleRepository } from './repository.js'

export class ClearSampleLoader {
  constructor(private readonly repository: ClearSampleRepository) {}

  async loadContent(
    content: ClearContent,
    population: StoredClearPopulation
  ): Promise<ClearContentWeekSamples> {
    const { weekStart } = population
    const previousWeekStart = subWeeks(weekStart, 1)
    const selection = { contentId: content.id, kind: content.kind, weekStart }
    const weekly = content.kind !== 'challenge'
    const scored = hasScoreStats(weekStart)
    const pair = findStagePair(content)
    const minFame = population.minFame ?? toPopulationMinFame(content, toCollectionMinFame())
    const comparison = { contentId: content.id, weekStart, previousWeekStart }
    const raidName =
      content.kind === 'raid' && content.rule.type === 'clear' ? content.rule.name : undefined
    const jobFames = await this.repository.readContentJobFames(selection)
    const jobScores = scored ? await this.repository.readContentJobScores(selection) : []
    const adventures = await this.repository.readAdventureSizes(selection)
    const fameBands = await this.repository.readFameBands(selection, minFame)
    const scoreBands = scored ? await this.repository.readScoreBands(selection, minFame) : []
    const times = await this.repository.readContentTimes(selection)
    const weekGroups = weekly ? await this.repository.readWeekGroups(comparison) : null
    const weekGroupScores = weekly ? await this.loadWeekGroupScores(comparison) : null
    const weekMoves =
      pair !== undefined
        ? await this.repository.readWeekMoves({
            hardContentId: pair.hard.id,
            normalContentId: pair.normal.id,
            weekStart,
            previousWeekStart
          })
        : null

    const streaks = weekly ? await this.repository.readStreaks(selection) : null
    const stages = raidName !== undefined ? await this.loadStages(raidName, weekStart) : null

    return {
      jobFames,
      jobScores,
      adventures,
      fameBands,
      scoreBands,
      times,
      weekGroups,
      weekGroupScores,
      weekMoves,
      streaks,
      stages
    }
  }

  async loadOverview(weekStart: Date): Promise<ClearOverviewWeekSamples> {
    // 한 주의 모든 컨텐츠를 읽는 쿼리는 PostgreSQL이 병렬 worker로 돌린다. 다섯 개를 함께 보내면 worker들이
    // 공유 메모리(shm)를 동시에 잡아 운영 DB에서 "could not resize shared memory segment"로 실패해 하나씩 읽는다.
    const fames = await this.repository.readFames(weekStart)
    const jobFames = await this.repository.readJobFames(weekStart)
    const scored = hasScoreStats(weekStart)
    const scores = scored ? await this.repository.readScores(weekStart) : []
    const jobScores = scored ? await this.repository.readJobScores(weekStart) : []
    const raidTimes = await this.repository.readRaidTimes(weekStart)

    return { fames, jobFames, scores, jobScores, raidTimes }
  }

  // 이탈 그룹은 지난주 행의 점수를 쓰므로 지난주도 점수 통계를 내는 주여야 한다.
  private async loadWeekGroupScores(comparison: ClearWeekComparison) {
    if (!hasScoreStats(comparison.previousWeekStart)) {
      return []
    }

    return this.repository.readWeekGroupScores(comparison)
  }

  // 단계 라벨은 수집 판정과 같은 함수로 정하고, 단계 라벨이 없는 기록(이내 황혼전)은 세지 않는다.
  private async loadStages(raidName: string, weekStart: Date) {
    const selection = { raidName, weekStart }
    const modes = await this.repository.readRaidModes(selection)
    const stages = modes.flatMap(({ modeName, hard }) => {
      const stage = toRaidStageLabel({ modeName, hard: hard ?? false })

      if (stage === null) {
        return []
      }

      return [{ modeName, hard, stage }]
    })

    if (stages.length === 0) {
      return []
    }

    return this.repository.readRaidStageCounts(selection, stages)
  }
}
