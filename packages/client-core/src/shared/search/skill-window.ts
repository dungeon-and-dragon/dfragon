import { z } from 'zod'
import type { CharacterDetailView } from './character-detail-view'

const skillSchema = z.object({
  name: z.string(),
  kind: z.enum(['active', 'passive']),
  requiredLevel: z.number().int().nullable(),
  maxLevel: z.number().int(),
  icon: z.object({ x: z.number().int(), y: z.number().int() })
})

const slotSchema = z.object({
  skillId: z.number().int(),
  col: z.number(),
  row: z.number(),
  nextSkills: z.array(z.number().int())
})

const advancementSchema = z.object({
  growtype: z.number().int(),
  name: z.string(),
  awakeningNames: z.array(z.string()),
  slots: z.array(slotSchema)
})

const jobSchema = z.object({
  jobId: z.string(),
  jobName: z.string(),
  sprite: z.string(),
  advancements: z.array(advancementSchema),
  skills: z.record(z.string(), skillSchema)
})

export const skillWindowCatalogSchema = z.object({
  pvfSha256: z.string(),
  jobs: z.array(jobSchema)
})

export type SkillWindowCatalog = z.infer<typeof skillWindowCatalogSchema>
type CatalogJob = SkillWindowCatalog['jobs'][number]
type CatalogAdvancement = CatalogJob['advancements'][number]
type CatalogSkill = CatalogJob['skills'][string]

export type SkillStyle = NonNullable<NonNullable<CharacterDetailView['skillStyle']>['style']>
export type LearnedSkill = SkillStyle['active'][number]

export type SkillWindowIcon = Readonly<{
  skillId: number
  name: string
  kind: CatalogSkill['kind']
  icon: Readonly<{ sprite: string; x: number; y: number }>
  col: number
  row: number
  requiredLevel: number | null
  learned: boolean
  level: number | null
}>

export type SkillWindowRow = Readonly<{ row: number; requiredLevel: number | null }>

export type SkillWindow = Readonly<{
  rows: readonly SkillWindowRow[]
  icons: readonly SkillWindowIcon[]
}>

const BEFORE_ADVANCEMENT_GROWTYPE = 0

// 크리에이터, 다크나이트는 Neople이 각성을 자각1, 자각2로 불러 전직 이름으로 고를 수 없고, 배치 블록도 하나뿐이다.
// 묶음의 growtype 1은 배울 수 없다고 본 슬롯을 뺐지만 실제 캐릭터가 그 스킬을 배우므로(2026-11-06 운영 응답 대조),
// 두 직업은 전직 상태와 관계없이 growtype 0 배치를 쓴다.
const SINGLE_TREE_JOB_NAMES: ReadonlySet<string> = new Set(['크리에이터', '다크나이트'])

function advancementOf(job: CatalogJob, jobGrowName: string): CatalogAdvancement | undefined {
  if (SINGLE_TREE_JOB_NAMES.has(job.jobName)) {
    return job.advancements.find(({ growtype }) => growtype === BEFORE_ADVANCEMENT_GROWTYPE)
  }

  return job.advancements.find(
    ({ growtype, name, awakeningNames }) =>
      growtype !== BEFORE_ADVANCEMENT_GROWTYPE &&
      (name === jobGrowName || awakeningNames.includes(jobGrowName))
  )
}

function mostCommonLevel(levels: readonly number[]): number | null {
  const counts = new Map<number, number>()
  for (const level of levels) {
    counts.set(level, (counts.get(level) ?? 0) + 1)
  }
  let picked: number | null = null
  let pickedCount = 0
  for (const [level, count] of counts) {
    if (count > pickedCount || (count === pickedCount && picked !== null && level < picked)) {
      picked = level
      pickedCount = count
    }
  }

  return picked
}

// 같은 줄에 습득 레벨이 다른 스킬이 섞이기도 한다(48과 50, 70과 75). 줄 머리에는 그 줄에 가장 많은 습득 레벨을 쓴다.
function rowsOf(icons: readonly SkillWindowIcon[]): SkillWindowRow[] {
  const levelsByRow = new Map<number, number[]>()
  for (const { row, requiredLevel } of icons) {
    const levels = levelsByRow.get(Math.floor(row)) ?? []
    if (requiredLevel !== null) {
      levels.push(requiredLevel)
    }
    levelsByRow.set(Math.floor(row), levels)
  }
  const lastRow = Math.max(...levelsByRow.keys())

  return Array.from({ length: lastRow + 1 }, (_, row) => {
    const requiredLevel = mostCommonLevel(levelsByRow.get(row) ?? [])

    return { row, requiredLevel }
  })
}

function jobCountWithSkill(catalog: SkillWindowCatalog, name: string): number {
  return catalog.jobs.filter((job) =>
    Object.values(job.skills).some((skill) => skill.name === name)
  ).length
}

// 같은 칸에 스킬이 둘 놓인 곳은 한쪽이 모든 직업에 같은 이름으로 있는 단계 스킬(찰나의 깨달음, 각성의 실마리 등)이고,
// 캐릭터는 眞 각성 전에 단계 스킬을, 뒤에 그 전직의 스킬을 배운다. 배운 스킬을 먼저 두고, 둘 다 배우지 않았으면 더 적은
// 직업에 있는 스킬(그 전직의 스킬)을 둔다.
function pickInCell(
  catalog: SkillWindowCatalog,
  candidates: readonly [SkillWindowIcon, ...SkillWindowIcon[]]
): SkillWindowIcon {
  return candidates.reduce((picked, candidate) => {
    if (candidate.learned !== picked.learned) {
      if (candidate.learned) {
        return candidate
      }

      return picked
    }

    if (jobCountWithSkill(catalog, candidate.name) < jobCountWithSkill(catalog, picked.name)) {
      return candidate
    }

    return picked
  })
}

export function skillWindowOf(
  catalog: SkillWindowCatalog,
  character: Readonly<{ jobName: string | null; jobGrowName: string | null }>,
  style: SkillStyle
): SkillWindow | null {
  const job = catalog.jobs.find(({ jobName }) => jobName === character.jobName)
  if (job === undefined || character.jobGrowName == null) {
    return null
  }
  const advancement = advancementOf(job, character.jobGrowName)
  if (advancement === undefined || advancement.slots.length === 0) {
    return null
  }
  const levelByName = new Map(
    [...style.active, ...style.passive].map((skill) => [skill.name, skill.level])
  )
  const cells = new Map<string, [SkillWindowIcon, ...SkillWindowIcon[]]>()
  for (const { skillId, col, row } of advancement.slots) {
    const skill = job.skills[skillId]
    if (skill === undefined) {
      continue
    }
    const icon: SkillWindowIcon = {
      skillId,
      name: skill.name,
      kind: skill.kind,
      icon: { sprite: job.sprite, ...skill.icon },
      col,
      row,
      requiredLevel: skill.requiredLevel,
      learned: levelByName.has(skill.name),
      level: levelByName.get(skill.name) ?? null
    }
    const key = `${col},${row}`
    const sameCell = cells.get(key)
    cells.set(key, sameCell !== undefined ? [...sameCell, icon] : [icon])
  }
  const icons = [...cells.values()].map((candidates) => pickInCell(catalog, candidates))
  const rows = rowsOf(icons)

  return { rows, icons }
}

export type LearnedSkillRow = Readonly<{
  requiredLevel: number | null
  skills: readonly LearnedSkill[]
}>

export function learnedSkillRowsOf(skills: readonly LearnedSkill[]): LearnedSkillRow[] {
  const skillsByLevel = new Map<number | null, LearnedSkill[]>()
  for (const skill of skills) {
    skillsByLevel.set(skill.requiredLevel, [
      ...(skillsByLevel.get(skill.requiredLevel) ?? []),
      skill
    ])
  }

  return [...skillsByLevel]
    .map(([requiredLevel, skills]) => ({ requiredLevel, skills }))
    .sort(
      (left, right) =>
        (left.requiredLevel ?? Number.POSITIVE_INFINITY) -
        (right.requiredLevel ?? Number.POSITIVE_INFINITY)
    )
}

export type SkillUpgrade = Readonly<{
  skillId: string | null
  name: string | null
  type: number | null
}>

export function skillUpgradesOf(
  style: SkillStyle,
  kind: 'evolution' | 'enhancement'
): SkillUpgrade[] {
  const nameById = new Map(
    [...style.active, ...style.passive].map((skill) => [skill.skillId, skill.name])
  )

  return style[kind].map(({ skillId, type }) => {
    const name = nameById.get(skillId) ?? null

    return { skillId, name, type }
  })
}
