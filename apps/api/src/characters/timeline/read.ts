import {
  type DatabaseClient,
  type TimelineCharacter,
  type TimelineEventRow,
  type TimelineItemRow,
  readCurrentSeasonStart,
  readRecentTimelineItems,
  readTimelineEvents
} from '@dfragon/database'
import { z } from 'zod'
import { startOfResetWeek } from '../../utils/seoul-time.js'

const RAID_CLEAR_CODES = [201, 210]
const LEGION_CLEAR_CODE = 209
export const CLEAR_CODES = [...RAID_CLEAR_CODES, LEGION_CLEAR_CODE]
type ClearKind = 'raid' | 'legion'
type EnhancementKind = 'reinforce' | 'amplify' | 'refine'

const ENHANCEMENT_KINDS = new Map<number, EnhancementKind>([
  [401, 'reinforce'],
  [402, 'amplify'],
  [403, 'refine']
])
const ACQUISITION_CODES = [
  501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519,
  520, 521, 550, 551, 552, 553, 554, 555, 556, 557
]
const ACQUISITION_RARITIES = ['에픽', '태초']
const RECENT_LIMIT = 50

export type TimelineClear = {
  kind: ClearKind
  name: string
  modeName: string | null
  occurredAt: Date
}

export type TimelineClearCount = {
  kind: ClearKind
  name: string
  count: number
}

export type TimelineEnhancement = {
  kind: EnhancementKind
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  before: number | null
  after: number
  result: boolean
  safe: boolean | null
  occurredAt: Date
}

export type TimelineAcquisition = {
  code: number
  name: string
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  occurredAt: Date
}

export type CharacterTimeline = {
  weeklyClears: TimelineClear[]
  seasonClears: TimelineClearCount[]
  enhancements: TimelineEnhancement[]
  acquisitions: TimelineAcquisition[]
}

export type TimelineRecords = {
  clears: readonly TimelineEventRow[]
  enhancements: readonly TimelineItemRow[]
  acquisitions: readonly TimelineItemRow[]
}

export const EMPTY_CHARACTER_TIMELINE: CharacterTimeline = {
  weeklyClears: [],
  seasonClears: [],
  enhancements: [],
  acquisitions: []
}

// 저장한 data는 Neople 응답의 객체지만 행마다 필드가 다를 수 있어 쓰기 전에 확인한다.
const raidClearData = z.object({ modeName: z.string().nullable().catch(null) })
const legionClearData = z.object({ regionName: z.string() })
const enhancementData = z.object({
  before: z.number().nullable().catch(null),
  after: z.number(),
  result: z.boolean(),
  safe: z.boolean().nullable().catch(null)
})

export function toClear({ code, occurredAt, raidName, data }: TimelineEventRow): TimelineClear[] {
  if (code === LEGION_CLEAR_CODE) {
    const legion = legionClearData.safeParse(data)
    if (!legion.success) {
      return []
    }

    return [{ kind: 'legion', name: legion.data.regionName, modeName: null, occurredAt }]
  }

  const raid = raidClearData.safeParse(data)
  if (raidName === null || !raid.success) {
    return []
  }

  return [{ kind: 'raid', name: raidName, modeName: raid.data.modeName, occurredAt }]
}

function countClears(clears: readonly TimelineClear[]): TimelineClearCount[] {
  const counts = new Map<string, TimelineClearCount>()
  for (const { kind, name } of clears) {
    const key = `${kind}/${name}`
    const count = counts.get(key)
    if (count === undefined) {
      counts.set(key, { kind, name, count: 1 })
    } else {
      count.count++
    }
  }

  return [...counts.values()]
}

function toEnhancement(row: TimelineItemRow): TimelineEnhancement[] {
  const kind = ENHANCEMENT_KINDS.get(row.code)
  const enhancement = enhancementData.safeParse(row.data)
  if (kind === undefined || !enhancement.success) {
    return []
  }
  const { before, after, result, safe } = enhancement.data

  return [
    {
      kind,
      itemId: row.itemId,
      itemName: row.itemName,
      itemRarity: row.itemRarity,
      before,
      after,
      result,
      safe,
      occurredAt: row.occurredAt
    }
  ]
}

function toAcquisition({
  code,
  name,
  itemId,
  itemName,
  itemRarity,
  occurredAt
}: TimelineItemRow): TimelineAcquisition {
  return { code, name, itemId, itemName, itemRarity, occurredAt }
}

export function toCharacterTimeline(
  records: TimelineRecords,
  weekStart: Date,
  seasonStart: Date
): CharacterTimeline {
  const clears = records.clears.flatMap(toClear)
  const weeklyClears = clears.filter(({ occurredAt }) => occurredAt >= weekStart)
  const seasonClears = countClears(clears.filter(({ occurredAt }) => occurredAt >= seasonStart))
  const enhancements = records.enhancements.flatMap(toEnhancement)
  const acquisitions = records.acquisitions.map(toAcquisition)

  return { weeklyClears, seasonClears, enhancements, acquisitions }
}

export async function readCharacterTimeline(
  client: DatabaseClient,
  character: TimelineCharacter,
  now: Date
): Promise<CharacterTimeline> {
  const weekStart = startOfResetWeek(now)
  const seasonStart = await readCurrentSeasonStart(client, now)
  if (seasonStart === undefined) {
    throw new Error('No season has started')
  }
  const since = new Date(Math.min(weekStart.getTime(), seasonStart.getTime()))
  const [clears, enhancements, acquisitions] = await Promise.all([
    readTimelineEvents(client, character, CLEAR_CODES, since),
    readRecentTimelineItems(client, character, {
      codes: [...ENHANCEMENT_KINDS.keys()],
      limit: RECENT_LIMIT
    }),
    readRecentTimelineItems(client, character, {
      codes: ACQUISITION_CODES,
      itemRarities: ACQUISITION_RARITIES,
      limit: RECENT_LIMIT
    })
  ])

  return toCharacterTimeline({ clears, enhancements, acquisitions }, weekStart, seasonStart)
}
