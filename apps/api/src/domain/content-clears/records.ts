import type { ClearRecordInput, TimelineCharacter } from '@dfragon/database'
import { z } from 'zod'
import { LEGION_CLEAR_CODE, RAID_CLEAR_CODES } from '../character-timeline/project.js'
import type { TimelineRow } from '../character-timeline/rows.js'
import { startOfResetWeek } from '../seoul-time.js'

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
