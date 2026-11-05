import { z } from 'zod'

const nullableText = z.string().nullable()
const occurredAt = z.iso.datetime()
export const clearKind = z.enum(['raid', 'legion'])
// cursor를 보내기 전의 API 응답은 이어 받을 기록이 없는 것으로 읽는다.
const timelineCursor = z.string().nullable().default(null)

const timelineEnhancementSchema = z.object({
  kind: z.enum(['reinforce', 'amplify', 'refine']),
  itemId: nullableText,
  itemName: nullableText,
  itemRarity: nullableText,
  before: z.number().int().nullable(),
  after: z.number().int(),
  result: z.boolean(),
  safe: z.boolean().nullable(),
  occurredAt
})

const timelineAcquisitionSchema = z.object({
  code: z.number().int(),
  name: z.string(),
  itemId: nullableText,
  itemName: nullableText,
  itemRarity: z.enum(['에픽', '태초']),
  occurredAt
})

export const characterTimelineSchema = z.object({
  weeklyClears: z.array(
    z.object({
      kind: clearKind,
      name: z.string(),
      modeName: nullableText,
      hard: z.boolean().default(false),
      occurredAt
    })
  ),
  seasonClears: z.array(
    z.object({
      kind: clearKind,
      name: z.string(),
      hard: z.boolean().default(false),
      count: z.number().int().positive()
    })
  ),
  enhancements: z.array(timelineEnhancementSchema),
  enhancementsCursor: timelineCursor,
  acquisitions: z.array(timelineAcquisitionSchema),
  acquisitionsCursor: timelineCursor
})

export const timelineEnhancementPageSchema = z.object({
  items: z.array(timelineEnhancementSchema),
  nextCursor: timelineCursor
})

export const timelineAcquisitionPageSchema = z.object({
  items: z.array(timelineAcquisitionSchema),
  nextCursor: timelineCursor
})

export type CharacterTimeline = z.infer<typeof characterTimelineSchema>
export type TimelineClear = CharacterTimeline['weeklyClears'][number]
export type TimelineClearCount = CharacterTimeline['seasonClears'][number]
export type TimelineEnhancement = CharacterTimeline['enhancements'][number]
export type TimelineAcquisition = CharacterTimeline['acquisitions'][number]
export type TimelinePage<Item> = Readonly<{ items: Item[]; nextCursor: string | null }>
