import { z } from 'zod'

const nonblankString = z.string().refine((value) => value.trim().length > 0)

export const characterSearchSchema = z.object({
  rows: z.array(
    z.looseObject({
      characterId: nonblankString,
      characterName: nonblankString,
      serverId: nonblankString,
      fame: z.number().nullish(),
      jobName: z.unknown().optional(),
      jobGrowName: z.unknown().optional()
    })
  )
})

export type NeopleCharacterSearchRow = z.output<typeof characterSearchSchema>['rows'][number]

export const serversSchema = z.object({
  rows: z.array(z.looseObject({ serverId: nonblankString }))
})

export const jobsSchema = z.object({
  rows: z.array(
    z.looseObject({
      jobId: nonblankString,
      rows: z.array(z.looseObject({ jobGrowId: nonblankString }))
    })
  )
})

export const charactersFameSchema = z.object({
  rows: z.array(z.looseObject({ characterId: nonblankString, fame: z.int() }))
})

export const NEOPLE_CHARACTER_SECTIONS = {
  basic: { path: '', fields: [] },
  status: { path: '/status', fields: ['status', 'buff'] },
  equipment: { path: '/equip/equipment', fields: ['equipment', 'setItemInfo'] },
  avatar: { path: '/equip/avatar', fields: ['avatar'] },
  creature: { path: '/equip/creature', fields: ['creature'] },
  oath: { path: '/equip/oath', fields: ['oath'] },
  mist_assimilation: { path: '/equip/mist-assimilation', fields: ['mistAssimilation'] },
  skill_style: { path: '/skill/style', fields: ['skill'] },
  buff_equipment: { path: '/skill/buff/equip/equipment', fields: ['skill'] },
  buff_avatar: { path: '/skill/buff/equip/avatar', fields: ['skill'] },
  buff_creature: { path: '/skill/buff/equip/creature', fields: ['skill'] }
} as const satisfies Record<string, { path: string; fields: readonly string[] }>

export type NeopleCharacterSection = keyof typeof NEOPLE_CHARACTER_SECTIONS

const characterSchema = z.looseObject({
  characterId: z.string(),
  serverId: z.string(),
  characterName: nonblankString
})

export type NeopleCharacter = z.output<typeof characterSchema>

// API는 섹션 안을 해석하지 않고 그대로 넘기므로 섹션 값은 객체(배열 포함)이거나 미장착 null인지만 본다.
function sectionSchema(fields: readonly string[]) {
  return characterSchema.refine((body) => fields.every((field) => typeof body[field] === 'object'))
}

export const characterSectionSchemas = Object.fromEntries(
  Object.entries(NEOPLE_CHARACTER_SECTIONS).map(([section, { fields }]) => [
    section,
    sectionSchema(fields)
  ])
) as Record<NeopleCharacterSection, ReturnType<typeof sectionSchema>>

export const characterBasicSchema = z.object({
  characterId: nonblankString,
  serverId: nonblankString,
  characterName: nonblankString,
  level: z.int(),
  jobId: nonblankString,
  jobGrowId: nonblankString,
  jobName: nonblankString,
  jobGrowName: nonblankString,
  fame: z.int().nullable().default(null),
  adventureName: nonblankString,
  guildId: z.string().nullable().default(null),
  guildName: z.string().nullable().default(null)
})

export type NeopleCharacterBasic = z.output<typeof characterBasicSchema>

const learnedSkillSchema = z.looseObject({
  skillId: nonblankString,
  name: nonblankString,
  level: z.int()
})

const selectedSkillSchema = z.looseObject({ skillId: nonblankString, type: z.int() })

// 체인 모양이 어긋나도 스킬, 개화, 강화는 저장해야 하므로 체인만 모름으로 받는다.
const skillChainSchema = z
  .looseObject({ skills: z.array(nonblankString.nullable()) })
  .nullable()
  .catch(null)

type LearnedSkill = z.output<typeof learnedSkillSchema>
type SelectedSkill = z.output<typeof selectedSkillSchema>
type SkillChain = NonNullable<z.output<typeof skillChainSchema>>

function namedSelections(selections: readonly SelectedSkill[], learned: readonly LearnedSkill[]) {
  const names = new Map(learned.map(({ skillId, name }) => [skillId, name]))

  return selections.flatMap(({ skillId, type }) => {
    const name = names.get(skillId)
    // 배운 목록에 없는 스킬은 이름으로 이을 수 없고 Neople 스킬 ID는 저장하지 않으므로 뺀다.
    if (name === undefined) {
      return []
    }

    return [{ name, type }]
  })
}

// 스킬 체인은 칸마다 스킬 ID나 null이 온다. 한 칸이라도 이름으로 잇지 못하면 순서가 어긋난 조합이 되므로 체인 전체를 모름으로 둔다.
function namedChain(chain: SkillChain | null, learned: readonly LearnedSkill[]) {
  if (chain === null) {
    return null
  }

  const names = new Map(learned.map(({ skillId, name }) => [skillId, name]))
  const slots: (string | null)[] = []

  for (const skillId of chain.skills) {
    if (skillId === null) {
      slots.push(null)
      continue
    }

    const name = names.get(skillId)
    if (name === undefined) {
      return null
    }

    slots.push(name)
  }

  return slots
}

function listOrEmpty<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .nullish()
    .transform((list) => list ?? [])
}

export const characterSkillStyleSchema = z
  .looseObject({
    jobId: nonblankString,
    jobGrowId: nonblankString,
    skill: z.looseObject({
      style: z.looseObject({
        active: z.array(learnedSkillSchema),
        passive: listOrEmpty(learnedSkillSchema),
        evolution: listOrEmpty(selectedSkillSchema),
        enhancement: listOrEmpty(selectedSkillSchema),
        chain: skillChainSchema
      })
    })
  })
  .transform(({ jobId, jobGrowId, skill: { style } }) => {
    const learned = [...style.active, ...style.passive]
    const skills = learned.map(({ name, level }) => ({ name, level }))
    const evolutions = namedSelections(style.evolution, learned)
    const enhancements = namedSelections(style.enhancement, learned)
    const chain = namedChain(style.chain, learned)

    return { jobId, jobGrowId, skills, evolutions, enhancements, chain }
  })

export type NeopleCharacterSkillStyle = z.output<typeof characterSkillStyleSchema>

const TIMELINE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

export const timelinePageSchema = z.object({
  timeline: z.object({
    rows: z.array(
      z.object({
        code: z.int(),
        name: z.string(),
        date: z.string().regex(TIMELINE_DATE_PATTERN),
        // 실제 응답의 101(캐릭터 생성) 행은 data가 null이다(#1186).
        data: z.record(z.string(), z.unknown()).nullable()
      })
    ),
    next: z.string().nullish()
  })
})

export type NeopleTimelinePage = z.output<typeof timelinePageSchema>['timeline']
export type NeopleTimelineRow = NeopleTimelinePage['rows'][number]

// 요청한 아이템이 빠지거나 행 모양이 달라도 나머지 아이템은 쓸 수 있도록 행은 호출한 쪽이 고른다.
export const multiItemsSchema = z.object({ rows: z.array(z.unknown()) })

export const itemShopSchema = z.looseObject({ itemGradeValue: z.number() })

export const auctionSchema = z.object({
  rows: z.array(
    z.looseObject({
      itemId: nonblankString,
      itemName: nonblankString,
      itemRarity: nonblankString.optional(),
      itemTypeDetail: nonblankString.optional(),
      unitPrice: z.int().positive()
    })
  )
})

export type NeopleAuctionRow = z.output<typeof auctionSchema>['rows'][number]

export const itemSearchSchema = z.object({
  rows: z.array(
    z.looseObject({
      itemId: nonblankString,
      itemName: nonblankString,
      itemRarity: nonblankString
    })
  )
})

export type NeopleItemSearchRow = z.output<typeof itemSearchSchema>['rows'][number]

export const skillSchema = z.looseObject({
  jobId: z.string(),
  name: nonblankString,
  skillId: z.string().optional()
})

export type NeopleSkill = z.output<typeof skillSchema>
