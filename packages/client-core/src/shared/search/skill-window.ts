import { z } from 'zod'
import type { CharacterDetailView } from './character-detail-view'

const evolutionBranchSchema = z.object({
  name: z.string(),
  basicExplain: z.string(),
  explain: z.string()
})
const enhancementBranchSchema = z.object({ explain: z.string() })

// 개화, 강화와 표식은 detail-extras 묶음을 함께 넣어 만든 데이터에만 있다.
const skillSchema = z.object({
  name: z.string(),
  kind: z.enum(['active', 'passive']),
  requiredLevel: z.number().int().nullable(),
  maxLevel: z.number().int(),
  icon: z.object({ x: z.number().int(), y: z.number().int() }),
  evolution: z.tuple([evolutionBranchSchema, evolutionBranchSchema]).optional(),
  enhancement: z.object({ 1: enhancementBranchSchema, 2: enhancementBranchSchema }).optional()
})

const markPairSchema = z.tuple([z.string(), z.string()])
const marksSchema = z.object({ evolution: markPairSchema, enhancement: markPairSchema })

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
  marks: marksSchema.optional(),
  jobs: z.array(jobSchema)
})

export type SkillWindowCatalog = z.infer<typeof skillWindowCatalogSchema>
type CatalogJob = SkillWindowCatalog['jobs'][number]
type CatalogAdvancement = CatalogJob['advancements'][number]
type CatalogSkill = CatalogJob['skills'][string]

export type SkillMarks = z.infer<typeof marksSchema>

export type SkillStyle = NonNullable<NonNullable<CharacterDetailView['skillStyle']>['style']>
export type LearnedSkill = SkillStyle['active'][number]

export type UpgradeType = 1 | 2

export type SkillIconImage = Readonly<{ sprite: string; x: number; y: number }>

export type SkillWindowIcon = Readonly<{
  skillId: number
  name: string
  kind: CatalogSkill['kind']
  icon: SkillIconImage
  col: number
  row: number
  requiredLevel: number | null
  learned: boolean
  level: number | null
  evolution: UpgradeType | null
  enhancement: UpgradeType | null
}>

export type SkillWindowRow = Readonly<{ row: number; requiredLevel: number | null }>

export type SkillWindow = Readonly<{
  rows: readonly SkillWindowRow[]
  icons: readonly SkillWindowIcon[]
  marks: SkillMarks | null
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

// 같은 줄에 습득 레벨이 다른 스킬이 섞이기도 한다(48과 50, 70과 75). 줄 헤더에는 그 줄에 가장 많은 습득 레벨을 쓴다.
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

type SkillCharacter = Readonly<{ jobName: string | null; jobGrowName: string | null }>

type SkillTree = Readonly<{ job: CatalogJob; advancement: CatalogAdvancement }>

function skillTreeOf(catalog: SkillWindowCatalog, character: SkillCharacter): SkillTree | null {
  const job = catalog.jobs.find(({ jobName }) => jobName === character.jobName)
  if (job === undefined || character.jobGrowName == null) {
    return null
  }
  const advancement = advancementOf(job, character.jobGrowName)
  if (advancement === undefined || advancement.slots.length === 0) {
    return null
  }

  return { job, advancement }
}

function upgradeTypeOf(type: number | null): UpgradeType | null {
  if (type === 1 || type === 2) {
    return type
  }

  return null
}

// 개화, 강화의 skillId는 API의 32자리 ID라 배운 스킬에서 이름을 찾아, 스킬 창 데이터와 이름으로 잇는다.
function pickedTypesByName(
  style: SkillStyle,
  kind: 'evolution' | 'enhancement'
): Map<string | null, UpgradeType> {
  const nameById = new Map(
    [...style.active, ...style.passive].map((skill) => [skill.skillId, skill.name])
  )
  const picked = new Map<string | null, UpgradeType>()
  for (const { skillId, type } of style[kind]) {
    const upgradeType = upgradeTypeOf(type)
    const name = nameById.get(skillId)
    if (upgradeType !== null && name !== undefined) {
      picked.set(name, upgradeType)
    }
  }

  return picked
}

export function skillWindowOf(
  catalog: SkillWindowCatalog,
  character: SkillCharacter,
  style: SkillStyle
): SkillWindow | null {
  const tree = skillTreeOf(catalog, character)
  if (tree === null) {
    return null
  }
  const { job, advancement } = tree
  const levelByName = new Map(
    [...style.active, ...style.passive].map((skill) => [skill.name, skill.level])
  )
  const evolutionByName = pickedTypesByName(style, 'evolution')
  const enhancementByName = pickedTypesByName(style, 'enhancement')
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
      level: levelByName.get(skill.name) ?? null,
      evolution: evolutionByName.get(skill.name) ?? null,
      enhancement: enhancementByName.get(skill.name) ?? null
    }
    const key = `${col},${row}`
    const sameCell = cells.get(key)
    cells.set(key, sameCell !== undefined ? [...sameCell, icon] : [icon])
  }
  const icons = [...cells.values()].map((candidates) => pickInCell(catalog, candidates))
  const rows = rowsOf(icons)

  const marks = catalog.marks ?? null

  return { rows, icons, marks }
}

type UpgradeSkill = Readonly<{
  skillId: number
  name: string
  requiredLevel: number | null
  icon: SkillIconImage
  picked: UpgradeType | null
}>

export type EvolutionBranch = Readonly<{
  type: UpgradeType
  name: string
  basicExplain: string
  explain: string
}>

export type EnhancementBranch = Readonly<{ type: UpgradeType }>

export type EvolutionRow = UpgradeSkill &
  Readonly<{ branches: readonly [EvolutionBranch, EvolutionBranch] }>

export type EnhancementRow = UpgradeSkill &
  Readonly<{ branches: readonly [EnhancementBranch, EnhancementBranch] }>

export type SkillUpgradeBoard = Readonly<{
  marks: SkillMarks
  evolutions: readonly EvolutionRow[]
  enhancements: readonly EnhancementRow[]
}>

type LearnableSkill = Readonly<{ skillId: number; skill: CatalogSkill }>

// 그 전직이 배울 수 있는 스킬은 전직 배치의 슬롯 스킬이다. 습득 레벨, 줄, 열 순서로 둔다.
function learnableSkillsOf({ job, advancement }: SkillTree): LearnableSkill[] {
  const slots = [...advancement.slots].sort(
    (left, right) =>
      (job.skills[left.skillId]?.requiredLevel ?? Number.POSITIVE_INFINITY) -
        (job.skills[right.skillId]?.requiredLevel ?? Number.POSITIVE_INFINITY) ||
      left.row - right.row ||
      left.col - right.col
  )
  const learnable = new Map<number, LearnableSkill>()
  for (const { skillId } of slots) {
    const skill = job.skills[skillId]
    if (skill !== undefined && !learnable.has(skillId)) {
      learnable.set(skillId, { skillId, skill })
    }
  }

  return [...learnable.values()]
}

function upgradeSkillOf(
  job: CatalogJob,
  { skillId, skill }: LearnableSkill,
  picked: Map<string | null, UpgradeType>
): UpgradeSkill {
  const pickedType = picked.get(skill.name) ?? null

  return {
    skillId,
    name: skill.name,
    requiredLevel: skill.requiredLevel,
    icon: { sprite: job.sprite, ...skill.icon },
    picked: pickedType
  }
}

export function skillMarkOf(marks: SkillMarks, kind: keyof SkillMarks, type: UpgradeType): string {
  const [first, second] = marks[kind]
  if (type === 1) {
    return first
  }

  return second
}

export function skillUpgradeBoardOf(
  catalog: SkillWindowCatalog,
  character: SkillCharacter,
  style: SkillStyle
): SkillUpgradeBoard | null {
  const tree = skillTreeOf(catalog, character)
  if (tree === null || catalog.marks === undefined) {
    return null
  }
  const learnable = learnableSkillsOf(tree)
  const evolutionByName = pickedTypesByName(style, 'evolution')
  const enhancementByName = pickedTypesByName(style, 'enhancement')
  const evolutions = learnable.flatMap((learnableSkill): EvolutionRow[] => {
    const branches = learnableSkill.skill.evolution
    if (branches === undefined) {
      return []
    }
    const [first, second] = branches

    return [
      {
        ...upgradeSkillOf(tree.job, learnableSkill, evolutionByName),
        branches: [
          { type: 1, ...first },
          { type: 2, ...second }
        ]
      }
    ]
  })
  const enhancements = learnable.flatMap((learnableSkill): EnhancementRow[] => {
    if (learnableSkill.skill.enhancement === undefined) {
      return []
    }
    const enhancement = upgradeSkillOf(tree.job, learnableSkill, enhancementByName)
    if (enhancement.picked === null) {
      return []
    }

    return [{ ...enhancement, branches: [{ type: 1 }, { type: 2 }] }]
  })

  return { marks: catalog.marks, evolutions, enhancements }
}

export type SkillChainLink = Readonly<{ name: string | null; icon: SkillIconImage | null }>

export type SkillChain = Readonly<{ skills: readonly SkillChainLink[] }>

export function skillChainOf(
  catalog: SkillWindowCatalog | null,
  character: SkillCharacter,
  style: SkillStyle
): SkillChain | null {
  // 체인을 비워 둔 캐릭터도 칸 수만큼 null이 온다(2026-11-06 운영 응답).
  const chainSkillIds = style.chain?.skills.filter((skillId) => skillId !== null) ?? []
  if (style.chain === null || chainSkillIds.length === 0) {
    return null
  }
  const nameById = new Map(
    [...style.active, ...style.passive].map((skill) => [skill.skillId, skill.name])
  )
  const tree = catalog !== null ? skillTreeOf(catalog, character) : null
  const iconByName = new Map(
    tree !== null
      ? learnableSkillsOf(tree).map(({ skill }) => [
          skill.name,
          { sprite: tree.job.sprite, ...skill.icon }
        ])
      : []
  )
  const skills = chainSkillIds.map((skillId) => {
    const name = nameById.get(skillId) ?? null
    const icon = iconByName.get(name ?? '') ?? null

    return { name, icon }
  })

  return { skills }
}

// 버프 강화의 skillInfo.skillId는 직업이 달라도 같은 값이 다시 나오는 API ID라, 그 전직이 배우는 스킬과 이름으로 잇는다.
export function buffSkillIconOf(
  catalog: SkillWindowCatalog,
  character: SkillCharacter,
  skillName: string
): SkillIconImage | null {
  const tree = skillTreeOf(catalog, character)
  if (tree === null) {
    return null
  }
  const learnable = learnableSkillsOf(tree).find(({ skill }) => skill.name === skillName)
  if (learnable === undefined) {
    return null
  }

  return { sprite: tree.job.sprite, ...learnable.skill.icon }
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
