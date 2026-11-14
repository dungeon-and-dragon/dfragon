import type {
  ClearContentWeekSamples,
  ClearOverviewWeekSamples,
  StoredClearPopulation
} from '@dfragon/database'
import { subWeeks } from 'date-fns'
import { toRaidStageLabel } from '../../domain/raid-stage.js'
import {
  type ClearContent,
  findStagePair,
  toCollectionMinFame,
  toPopulationMinFame
} from '../../domain/content-clears/contents.js'
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
    const raid = content.kind === 'raid'
    const pair = findStagePair(content)
    const minFame = population.minFame ?? toPopulationMinFame(content, toCollectionMinFame())
    const comparison = { contentId: content.id, weekStart, previousWeekStart }
    const raidName = content.rule.type === 'clear' ? content.rule.name : undefined
    const jobFames = await this.repository.readContentJobFames(selection)
    const jobScores = await this.repository.readContentJobScores(selection)
    const adventures = await this.repository.readAdventureSizes(selection)
    const fameBands = await this.repository.readFameBands(selection, minFame)
    const scoreBands = await this.repository.readScoreBands(selection, minFame)
    const times = await this.repository.readContentTimes(selection)
    const weekGroups = raid ? await this.repository.readWeekGroups(comparison) : null
    const weekGroupScores = raid ? await this.repository.readWeekGroupScores(comparison) : null
    const stageMoves =
      pair !== undefined
        ? await this.repository.readStageMoves({
            hardContentId: pair.hard.id,
            normalContentId: pair.normal.id,
            weekStart,
            previousWeekStart
          })
        : null

    const streaks = raid ? await this.repository.readStreaks(selection) : null
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
      stageMoves,
      streaks,
      stages
    }
  }

  async loadOverview(weekStart: Date): Promise<ClearOverviewWeekSamples> {
    // 한 주의 모든 컨텐츠를 읽는 쿼리는 PostgreSQL이 병렬 worker로 돌린다. 여섯 개를 함께 보내면 worker들이
    // 공유 메모리(shm)를 동시에 잡아 운영 DB에서 "could not resize shared memory segment"로 실패해 하나씩 읽는다.
    const fames = await this.repository.readFames(weekStart)
    const jobFames = await this.repository.readJobFames(weekStart)
    const scores = await this.repository.readScores(weekStart)
    const jobScores = await this.repository.readJobScores(weekStart)
    const coClears = await this.repository.readCoClears(weekStart)
    const raidTimes = await this.repository.readRaidTimes(weekStart)

    return { fames, jobFames, scores, jobScores, coClears, raidTimes }
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
