import { RANKING_JOBS, type RankingGrow, type RankingJob } from '#entities/character'
import {
  buffSkillIconOf,
  type SkillWindow,
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
import type { SkillChainRate, SkillUpgradeRate } from '#widgets/skill-window'
import { formatShare, shareOf } from './set-stats-bars'

// 저장소 소유자가 #2010 시안에서 정한 기준이다. 배운 표본이 20% 미만인 스킬은 흐리게, 배운 표본의 절반 이상이 고른 갈래만 표식을 그린다.
const LEARNED_SHARE_MIN = 0.2
const PICKED_SHARE_MIN = 0.5

const UNKNOWN_PICK: SkillWindowPick = { level: null, evolution: null, enhancement: null }

export type SkillStatsGrow = Readonly<{
  job: RankingJob
  grow: RankingGrow
  statsJob: SkillStatsJob
  filter: FameRankingFilter
}>

// 저장소 소유자가 정한 첫 화면이다.
const DEFAULT_JOB = RANKING_JOBS.find((job) => job.name === '귀검사(남)')!

export function skillStatsGrowOf({ jobId, jobGrowId, role }: FameRankingFilter): SkillStatsGrow {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId) ?? DEFAULT_JOB
  const selectedGrow = job.grows.find(
    (candidate) => candidate.jobGrowId === jobGrowId && candidate.role === role
  )
  const grow = selectedGrow ?? job.grows[0]!
  const statsRole = grow.role ?? null
  const statsJob = { jobId: job.jobId, jobGrowId: grow.jobGrowId, role: statsRole }
  const roleFilter = grow.role !== undefined ? { role: grow.role } : {}
  const filter = { jobId: job.jobId, jobGrowId: grow.jobGrowId, ...roleFilter }

  return { job, grow, statsJob, filter }
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

export type SkillUpgradeRateBoard = Readonly<{
  evolutions: readonly SkillUpgradeRate[]
  enhancements: readonly SkillUpgradeRate[]
}>

// 저장소 소유자가 정한 기준이다. 두 강화 비율이 모두 이 퍼센트 이하면 줄을 숨긴다.
const ENHANCED_SHARE_MIN = 1

function isEnhancedEnough(
  { name, type1, type2 }: SkillStats['enhancements'][number],
  learnedByName: ReadonlyMap<string, number>
): boolean {
  const learned = learnedByName.get(name) ?? 0

  return [type1, type2].some((count) => shareOf(count, learned) > ENHANCED_SHARE_MIN)
}

type IconOrder = Readonly<{ icon: SkillWindow['icons'][number]['icon']; order: number }>

function upgradeRatesOf(
  upgrades: SkillStats['evolutions'],
  learnedByName: ReadonlyMap<string, number>,
  iconByName: ReadonlyMap<string, IconOrder>
): SkillUpgradeRate[] {
  const rows = upgrades.map(({ name, type1, type2 }) => {
    const learned = learnedByName.get(name) ?? 0
    const placed = iconByName.get(name)
    const rates = [
      formatShare(shareOf(type1, learned)),
      formatShare(shareOf(type2, learned))
    ] as const
    const icon = placed?.icon ?? null
    const order = placed?.order ?? Number.POSITIVE_INFINITY

    return { row: { name, icon, rates }, order }
  })

  return rows.toSorted((left, right) => left.order - right.order).map(({ row }) => row)
}

export function skillUpgradeRateBoardOf(
  stats: SkillStats,
  skillWindow: SkillWindow
): SkillUpgradeRateBoard | null {
  if (stats.sampleSize < SKILL_STATS_MIN_SAMPLE) {
    return null
  }

  const learnedByName = new Map(stats.skills.map(({ name, learned }) => [name, learned]))
  const placedIcons = skillWindow.icons.toSorted(
    (left, right) => left.row - right.row || left.col - right.col
  )
  const iconByName = new Map(placedIcons.map(({ name, icon }, order) => [name, { icon, order }]))
  const evolutions = upgradeRatesOf(stats.evolutions, learnedByName, iconByName)
  const enhanced = stats.enhancements.filter((upgrade) => isEnhancedEnough(upgrade, learnedByName))
  const enhancements = upgradeRatesOf(enhanced, learnedByName, iconByName)

  return { evolutions, enhancements }
}
