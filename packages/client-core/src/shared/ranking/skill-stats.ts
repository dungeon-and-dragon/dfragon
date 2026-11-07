import { z } from 'zod'

const count = z.number().int().nonnegative()
const upgradeCounts = z.object({ name: z.string(), type1: count, type2: count })

export const skillStatsSchema = z.object({
  computedAt: z.iso.datetime(),
  topPercent: z.number().positive(),
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
  enhancements: z.array(upgradeCounts)
})

export type SkillStats = z.infer<typeof skillStatsSchema>
export type SkillStatsJob = Readonly<{ jobId: string; jobGrowId: string }>

// 저장소 소유자가 계획 승인 때 받아들인 기본값이다(구현 문서 11). 표본이 이보다 적으면 수치를 숨긴다.
export const SKILL_STATS_MIN_SAMPLE = 20

export type SkillUpgradeRates = readonly [number, number]
export type SkillEvolutionRates = Readonly<{
  names: readonly [string, string]
  rates: SkillUpgradeRates
}>

export type SkillAdoption = Readonly<{
  adoption: number
  levels: Readonly<{ p50: number; p95: number }> | null
  evolution: SkillEvolutionRates | null
  enhancement: SkillUpgradeRates | null
  sampleSize: number
  computedAt: string
}>

export type SkillAdoptionTarget = Readonly<{
  name: string
  evolutionNames: readonly [string, string] | null
  hasEnhancement: boolean
}>

type SkillLevels = SkillStats['skills'][number]['levels']

// 레벨 낮은 순 분포에서 배운 캐릭터의 percent%가 그 레벨 이하인 가장 낮은 레벨이다(nearest-rank).
function levelPercentile(levels: SkillLevels, learned: number, percent: number): number {
  const rank = Math.ceil((learned * percent) / 100)
  let seen = 0
  for (const [level, levelCount] of levels) {
    seen += levelCount
    if (seen >= rank) {
      return level
    }
  }

  throw new RangeError('레벨 분포의 인원 합이 배운 캐릭터 수보다 적다')
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
  { name, evolutionNames, hasEnhancement }: SkillAdoptionTarget
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
  const levelPercentiles = {
    p50: levelPercentile(levels, learned, 50),
    p95: levelPercentile(levels, learned, 95)
  }

  return {
    adoption,
    levels: levelPercentiles,
    evolution,
    enhancement,
    sampleSize,
    computedAt
  }
}
