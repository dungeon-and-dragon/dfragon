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
  fame: z.int().nullish(),
  adventureName: nonblankString,
  guildId: z.string().nullish(),
  guildName: z.string().nullish()
})

export type NeopleCharacterBasic = z.output<typeof characterBasicSchema>

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

export const skillSchema = z.looseObject({
  jobId: z.string(),
  name: nonblankString,
  skillId: z.string().optional()
})

export type NeopleSkill = z.output<typeof skillSchema>
