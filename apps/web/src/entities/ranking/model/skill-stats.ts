import { z } from 'zod'
import type { MaleCrusaderRole } from '#entities/character/@x/ranking'

const count = z.number().int().nonnegative()
const upgradeCounts = z.object({ name: z.string(), type1: count, type2: count })

export const skillStatsSchema = z.object({
  computedAt: z.iso.datetime().nullable(),
  minFame: z.number().int().nullable(),
  sampleSize: count,
  skills: z.array(
    z
      .object({
        name: z.string(),
        learned: count,
        levels: z.array(z.tuple([z.number().int(), z.number().int().positive()]))
      })
      .refine(
        ({ learned, levels }) =>
          levels.reduce((sum, [, levelCount]) => sum + levelCount, 0) === learned
      )
  ),
  evolutions: z.array(upgradeCounts),
  enhancements: z.array(upgradeCounts),
  chainSampleSize: count,
  chains: z.array(z.object({ skills: z.array(z.string().nullable()), count }))
})

export type SkillStats = z.infer<typeof skillStatsSchema>
export type SkillStatsJob = Readonly<{
  jobId: string
  jobGrowId: string
  role: MaleCrusaderRole | null
}>

// 저장소 소유자가 계획 승인 때 받아들인 기본값이다(구현 문서 11). 표본이 이보다 적으면 수치를 숨긴다.
export const SKILL_STATS_MIN_SAMPLE = 20

export type SkillUpgradeRates = readonly [number, number]
export type SkillEvolutionRates = Readonly<{
  names: readonly [string, string]
  rates: SkillUpgradeRates
}>

export type SkillLevelRate = Readonly<{ level: number; rate: number }>

export type SkillLevelDistribution = Readonly<{
  rates: readonly SkillLevelRate[]
  current: SkillLevelRate | null
  top: readonly SkillLevelRate[]
}>

const TOP_LEVEL_COUNT = 3

export type SkillAdoption = Readonly<{
  adoption: number
  levels: SkillLevelDistribution | null
  evolution: SkillEvolutionRates | null
  enhancement: SkillUpgradeRates | null
  sampleSize: number
  computedAt: string | null
}>

export type SkillAdoptionTarget = Readonly<{
  name: string
  level: number | null
  maxLevel: number
  evolutionNames: readonly [string, string] | null
  hasEnhancement: boolean
}>

type SkillLevels = SkillStats['skills'][number]['levels']

// 장비 옵션으로 마스터 레벨을 넘긴 캐릭터도 잘리지 않게 표본과 이 캐릭터의 가장 높은 레벨까지 칸을 둔다.
function levelDistributionOf(
  levels: SkillLevels,
  learned: number,
  { level, maxLevel }: Pick<SkillAdoptionTarget, 'level' | 'maxLevel'>
): SkillLevelDistribution {
  const countByLevel = new Map(levels)
  const lastLevel = Math.max(maxLevel, level ?? 0, ...countByLevel.keys())
  const rates = Array.from({ length: lastLevel }, (_, index) => {
    const barLevel = index + 1
    const rate = (countByLevel.get(barLevel) ?? 0) / learned

    return { level: barLevel, rate }
  })
  const current = rates.find((rate) => rate.level === level) ?? null
  const top = rates
    .filter(({ rate }) => rate > 0)
    .toSorted((left, right) => right.rate - left.rate || right.level - left.level)
    .slice(0, TOP_LEVEL_COUNT)

  return { rates, current, top }
}

function upgradeRates(
  upgrades: SkillStats['evolutions'],
  name: string,
  learned: number
): SkillUpgradeRates {
  const picked = upgrades.find((upgrade) => upgrade.name === name)
  if (picked === undefined) {
    return [0, 0]
  }

  return [picked.type1 / learned, picked.type2 / learned]
}

export function skillAdoptionOf(
  stats: SkillStats,
  { name, level, maxLevel, evolutionNames, hasEnhancement }: SkillAdoptionTarget
): SkillAdoption | null {
  const { sampleSize, computedAt } = stats
  if (sampleSize < SKILL_STATS_MIN_SAMPLE) {
    return null
  }
  const skill = stats.skills.find((candidate) => candidate.name === name)
  if (skill === undefined || skill.learned === 0) {
    return { adoption: 0, levels: null, evolution: null, enhancement: null, sampleSize, computedAt }
  }
  const { learned, levels } = skill
  const evolution =
    evolutionNames !== null
      ? { names: evolutionNames, rates: upgradeRates(stats.evolutions, name, learned) }
      : null
  const enhancement = hasEnhancement ? upgradeRates(stats.enhancements, name, learned) : null
  const adoption = learned / sampleSize
  const levelDistribution = levelDistributionOf(levels, learned, { level, maxLevel })

  return {
    adoption,
    levels: levelDistribution,
    evolution,
    enhancement,
    sampleSize,
    computedAt
  }
}
