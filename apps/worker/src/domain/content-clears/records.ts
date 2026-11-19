import type { ClearRecordInput, TimelineCharacter, TimelineRange } from '@dfragon/database'
import { z } from 'zod'
import {
  LEGION_CLEAR_CODE,
  RAID_CLEAR_CODES,
  TIMELINE_RECORD_DELAY_MS,
  type TimelineRow,
  splitTimelineRanges
} from '@dfragon/server-core/domain/character-timeline/index.js'
import { startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'

// 베누스 첫 클리어 주다. 지난 레이드, 레기온 기록은 이 주부터 받는다.
export const CLEAR_RECORD_BACKFILL_START = new Date('2025-02-06T06:00:00+09:00')

export function toClearRecordRanges(
  fetchedUntil: Date | undefined,
  startedAt: Date
): TimelineRange[] {
  if (fetchedUntil === undefined) {
    return splitTimelineRanges(CLEAR_RECORD_BACKFILL_START, startedAt)
  }

  const start = Math.max(
    fetchedUntil.getTime() - TIMELINE_RECORD_DELAY_MS,
    CLEAR_RECORD_BACKFILL_START.getTime()
  )

  return splitTimelineRanges(new Date(start), startedAt)
}

// Neople은 하드로 깬 레이드에만 hard: true를 넣고, 단계나 공격대 이름이 없는 레이드는 칸을 두지 않는다.
const raidRecordData = z.object({
  raidName: z.string(),
  modeName: z.string().nullable().catch(null),
  hard: z.boolean().catch(false),
  raidPartyName: z.string().nullable().catch(null)
})
const legionRecordData = z.object({ regionName: z.string() })

function toRecordBase(character: TimelineCharacter, row: TimelineRow) {
  const { serverId, characterId } = character
  const weekStart = startOfResetWeek(row.occurredAt)

  return { serverId, characterId, clearedAt: row.occurredAt, weekStart }
}

export function toClearRecordInput(
  character: TimelineCharacter,
  row: TimelineRow
): ClearRecordInput | undefined {
  if (row.code === LEGION_CLEAR_CODE) {
    const legion = legionRecordData.safeParse(row.data)

    if (!legion.success) {
      return undefined
    }

    const base = toRecordBase(character, row)

    return { ...base, kind: 'legion', name: legion.data.regionName }
  }

  if (!RAID_CLEAR_CODES.includes(row.code)) {
    return undefined
  }

  const raid = raidRecordData.safeParse(row.data)

  if (!raid.success) {
    return undefined
  }

  const base = toRecordBase(character, row)
  const { raidName, modeName, hard, raidPartyName } = raid.data

  return {
    ...base,
    kind: 'raid',
    name: raidName,
    modeName,
    hard,
    partyName: raidPartyName
  }
}
