import { RANKING_JOBS, type RankingGrow, type RankingJob } from '#entities/character'
import {
  buffSkillIconOf,
  type SkillWindowCatalog,
  type SkillWindowPick,
  type UpgradeType
} from '#entities/catalog'
import {
  type FameRankingFilter,
  SKILL_STATS_MIN_SAMPLE,
  type SkillStats,
  type SkillStatsJob
} from '#entities/ranking'
import type { SkillChainRate } from '#widgets/skill-window'
import { formatShare, shareOf } from './set-stats-bars'

// 저장소 소유자가 #2010 시안에서 정한 기준이다. 배운 표본이 20% 미만인 스킬은 흐리게, 배운 표본의 절반 이상이 고른 갈래만 표식을 그린다.
const LEARNED_SHARE_MIN = 0.2
const PICKED_SHARE_MIN = 0.5

const UNKNOWN_PICK: SkillWindowPick = { level: null, evolution: null, enhancement: null }

export type SkillStatsGrow = Readonly<{
  job: RankingJob
  grow: RankingGrow
  statsJob: SkillStatsJob
}>

export function skillStatsGrowOf({
  jobId,
  jobGrowId,
  role
}: FameRankingFilter): SkillStatsGrow | null {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)
  const grow = job?.grows.find(
    (candidate) => candidate.jobGrowId === jobGrowId && candidate.role === role
  )
  if (job === undefined || grow === undefined) {
    return null
  }
  const statsRole = role ?? null
  const statsJob = { jobId: job.jobId, jobGrowId: grow.jobGrowId, role: statsRole }

  return { job, grow, statsJob }
}

type SkillLevels = SkillStats['skills'][number]['levels']

function mostPickedLevel(levels: SkillLevels): number | null {
  const [picked] = levels.toSorted(
    ([leftLevel, leftCount], [rightLevel, rightCount]) =>
      rightCount - leftCount || rightLevel - leftLevel
  )

  if (picked === undefined) {
    return null
  }

  return picked[0]
}

function pickedTypeOf(
  upgrades: SkillStats['evolutions'],
  name: string,
  learned: number
): UpgradeType | null {
  const upgrade = upgrades.find((candidate) => candidate.name === name)
  if (upgrade === undefined) {
    return null
  }

  if (upgrade.type1 / learned >= PICKED_SHARE_MIN) {
    return 1
  }

  if (upgrade.type2 / learned >= PICKED_SHARE_MIN) {
    return 2
  }

  return null
}

export function skillStatsPickOf(stats: SkillStats): (name: string) => SkillWindowPick | null {
  if (stats.sampleSize < SKILL_STATS_MIN_SAMPLE) {
    return () => UNKNOWN_PICK
  }

  const picks = new Map<string, SkillWindowPick>()
  for (const { name, learned, levels } of stats.skills) {
    if (learned / stats.sampleSize >= LEARNED_SHARE_MIN) {
      const level = mostPickedLevel(levels)
      const evolution = pickedTypeOf(stats.evolutions, name, learned)
      const enhancement = pickedTypeOf(stats.enhancements, name, learned)
      picks.set(name, { level, evolution, enhancement })
    }
  }

  return (name) => picks.get(name) ?? null
}

export type SkillChainBoard =
  | Readonly<{ status: 'rates'; chains: readonly SkillChainRate[] }>
  | Readonly<{ status: 'few-samples' }>
  | Readonly<{ status: 'no-chains' }>

export function skillChainBoardOf(
  stats: SkillStats,
  catalog: SkillWindowCatalog,
  grow: RankingGrow
): SkillChainBoard {
  const { sampleSize, chainSampleSize, chains } = stats
  if (sampleSize < SKILL_STATS_MIN_SAMPLE || chainSampleSize < SKILL_STATS_MIN_SAMPLE) {
    return { status: 'few-samples' }
  }

  if (chains.length === 0) {
    return { status: 'no-chains' }
  }

  const character = { jobGrowName: grow.name }
  const rates = chains.map(({ skills, count }) => {
    const key = skills.join()
    const cells = skills.map((name) => {
      const icon = name !== null ? buffSkillIconOf(catalog, character, name) : null

      return { name, icon }
    })
    const share = shareOf(count, chainSampleSize)
    const rate = formatShare(share)

    return { key, skills: cells, rate }
  })

  return { status: 'rates', chains: rates }
}
