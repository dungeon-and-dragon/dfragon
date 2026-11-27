import { z } from 'zod'
import type { TimelineItemRow } from '@dfragon/database'

// 저장한 data는 Neople 응답의 객체지만 행마다 필드가 다를 수 있어 쓰기 전에 확인한다.
// Neople은 하드로 클리어한 레이드에만 hard: true를 넣고 나머지 행에는 칸을 두지 않는다.
const raidClearData = z.object({
  modeName: z.string().nullable().catch(null),
  hard: z.boolean().catch(false)
})
const legionClearData = z.object({ regionName: z.string() })

export function toTimelineClearData(code: number, value: unknown): TimelineClearRecord['data'] {
  const parsed =
    code === LEGION_CLEAR_CODE ? legionClearData.safeParse(value) : raidClearData.safeParse(value)
  const data = parsed.success ? parsed.data : null

  return data
}

export type TimelineClearRecord = {
  code: number
  occurredAt: Date
  raidName: string | null
  data: { regionName: string } | { modeName: string | null; hard: boolean } | null
}

export type TimelineEnhancementRecord = {
  id: bigint
  code: number
  occurredAt: Date
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  data: { before: number | null; after: number; result: boolean; safe: boolean | null } | null
}

export const RAID_CLEAR_CODES = [201, 210]
export const LEGION_CLEAR_CODE = 209
export const CLEAR_CODES = [...RAID_CLEAR_CODES, LEGION_CLEAR_CODE]
type ClearKind = 'raid' | 'legion'
export type EnhancementKind = 'reinforce' | 'amplify' | 'refine'

export const ENHANCEMENT_KINDS: ReadonlyMap<number, EnhancementKind> = new Map([
  [401, 'reinforce'],
  [402, 'amplify'],
  [403, 'refine']
])
export const ENHANCEMENT_CODES = [...ENHANCEMENT_KINDS.keys()]
// 정기 동기화가 받지 않는 중천 전의 캐릭터명 변경(102), 모험단명 변경(105)도 같은 요청으로 받는다.
export const ENHANCEMENT_BACKFILL_CODES = [102, 105, ...ENHANCEMENT_CODES]
export const ACQUISITION_CODES = [
  501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519,
  520, 521, 550, 551, 552, 553, 554, 555, 556, 557
]
export const TIMELINE_PAGE_SIZE = 50

export type TimelineClear = {
  kind: ClearKind
  name: string
  modeName: string | null
  hard: boolean
  occurredAt: Date
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

export function toClear({
  code,
  occurredAt,
  raidName,
  data
}: TimelineClearRecord): TimelineClear[] {
  if (data === null) {
    return []
  }

  if (code === LEGION_CLEAR_CODE) {
    if (!('regionName' in data)) {
      return []
    }

    return [{ kind: 'legion', name: data.regionName, modeName: null, hard: false, occurredAt }]
  }

  if (raidName === null || !('modeName' in data)) {
    return []
  }

  const { modeName, hard } = data

  return [{ kind: 'raid', name: raidName, modeName, hard, occurredAt }]
}

export function toEnhancement(row: TimelineEnhancementRecord): TimelineEnhancement[] {
  const kind = ENHANCEMENT_KINDS.get(row.code)
  const enhancement = row.data
  if (kind === undefined || enhancement === null) {
    return []
  }
  const { before, after, result, safe } = enhancement

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

export function toAcquisition({
  code,
  name,
  itemId,
  itemName,
  itemRarity,
  occurredAt
}: TimelineItemRow): TimelineAcquisition {
  return { code, name, itemId, itemName, itemRarity, occurredAt }
}
