import type { ContentClearInput, ContentClearKind, TimelineCharacter } from '@dfragon/database'
import { z } from 'zod'
import { toRaidStageLabel } from '../adventure-guild/activity.js'
import { RAID_CLEAR_CODES, toClear } from '../characters/timeline/read.js'
import type { TimelineRow } from '../characters/timeline/rows.js'
import { startOfResetWeek } from '../utils/seoul-time.js'

const BOX_ACQUISITION_CODE = 504

// 클리어 기록은 toClear의 이름(레이드는 raidName)과 활동 집계의 단계 라벨이 모두 같아야 맞는다.
// 단계가 null이면 modeName이 없는 기록이다.
export type ClearRecordRule = {
  type: 'clear'
  codes: readonly number[]
  name: string
  stage: string | null
}

export type ItemAcquisitionRule = {
  type: 'item'
  code: number
  itemId: string
}

export type ClearContentRule = ClearRecordRule | ItemAcquisitionRule

export type ClearContent = {
  id: string
  kind: ContentClearKind
  name: string
  releasedAt: Date
  rule: ClearContentRule
}

export type ContentClearMatch = {
  content: ClearContent
  ratio: number | null
}

function raidClear(raidName: string, stage: string | null): ClearRecordRule {
  return { type: 'clear', codes: RAID_CLEAR_CODES, name: raidName, stage }
}

// 출시일은 공식 업데이트 공지와 운영 DB의 첫 클리어 시각이 같은 날이다(2026-11-10). 업데이트는 06:00(KST) 초기화에 열린다.
export const CLEAR_CONTENTS: readonly ClearContent[] = [
  {
    id: 'nabel-normal',
    kind: 'raid',
    name: '만들어진 신 나벨 (일반)',
    releasedAt: new Date('2025-04-17T06:00:00+09:00'),
    rule: raidClear('만들어진 신 나벨', '일반')
  },
  {
    id: 'nabel-hard',
    kind: 'raid',
    name: '만들어진 신 나벨 (하드)',
    releasedAt: new Date('2025-04-17T06:00:00+09:00'),
    rule: raidClear('만들어진 신 나벨', '하드')
  },
  {
    id: 'inae-twilight',
    kind: 'raid',
    name: '이내 황혼전',
    releasedAt: new Date('2025-08-21T06:00:00+09:00'),
    rule: raidClear('이내 황혼전', null)
  },
  {
    id: 'diregie-normal',
    kind: 'raid',
    name: '디레지에 레이드 (일반)',
    releasedAt: new Date('2025-12-04T06:00:00+09:00'),
    rule: raidClear('디레지에 레이드', '일반')
  },
  {
    id: 'diregie-hard',
    kind: 'raid',
    name: '디레지에 레이드 (하드)',
    releasedAt: new Date('2026-02-05T06:00:00+09:00'),
    rule: raidClear('디레지에 레이드', '하드')
  },
  {
    id: 'michaela-normal',
    kind: 'raid',
    name: '무너진 성자 미카엘라 (일반)',
    releasedAt: new Date('2026-08-06T06:00:00+09:00'),
    rule: raidClear('무너진 성자 미카엘라', '일반')
  },
  {
    id: 'michaela-hard',
    kind: 'raid',
    name: '무너진 성자 미카엘라 (하드)',
    releasedAt: new Date('2026-08-06T06:00:00+09:00'),
    rule: raidClear('무너진 성자 미카엘라', '하드')
  },
  // 챌린지 클리어는 클리어 기록으로 남지 않고 보상 칭호 "황혼의 악연을 끊은 자"를 상자에서 얻은 기록으로만 남는다.
  {
    id: 'engraved-nightmare-1',
    kind: 'challenge',
    name: '각인된 악몽 "죽음을 딛고 선 자"',
    releasedAt: new Date('2026-11-05T06:00:00+09:00'),
    rule: { type: 'item', code: BOX_ACQUISITION_CODE, itemId: '070577c19e70e3ea723bbc924b111a12' }
  }
]

// 배율을 올려 깬 기록에만 data.ratio가 있다.
const ratioData = z.object({ ratio: z.number().int().nullable().catch(null) })
const raidNameData = z.object({ raidName: z.string().nullable().catch(null) })
const itemData = z.object({ itemId: z.string() })

function matchesClearRecord(rule: ClearRecordRule, row: TimelineRow): boolean {
  if (!rule.codes.includes(row.code)) {
    return false
  }
  const { raidName } = raidNameData.parse(row.data)

  return toClear({ ...row, raidName }).some(
    (clear) => clear.name === rule.name && toRaidStageLabel(clear) === rule.stage
  )
}

function matchesItemAcquisition(rule: ItemAcquisitionRule, row: TimelineRow): boolean {
  return row.code === rule.code && itemData.safeParse(row.data).data?.itemId === rule.itemId
}

function matchesRule(rule: ClearContentRule, row: TimelineRow): boolean {
  if (rule.type === 'clear') {
    return matchesClearRecord(rule, row)
  }

  return matchesItemAcquisition(rule, row)
}

export function findContentClear(
  row: TimelineRow,
  contents: readonly ClearContent[] = CLEAR_CONTENTS
): ContentClearMatch | undefined {
  const content = contents.find(({ rule }) => matchesRule(rule, row))
  if (content === undefined) {
    return undefined
  }
  const { ratio } = ratioData.parse(row.data)

  return { content, ratio }
}

export function toContentClearInput(
  character: TimelineCharacter,
  row: TimelineRow
): ContentClearInput | undefined {
  const match = findContentClear(row)
  if (match === undefined) {
    return undefined
  }
  const { content, ratio } = match
  const weekStart = startOfResetWeek(row.occurredAt)

  return {
    contentId: content.id,
    kind: content.kind,
    serverId: character.serverId,
    characterId: character.characterId,
    clearedAt: row.occurredAt,
    weekStart,
    ratio
  }
}

// 같은 레이드의 일반과 하드는 한 묶음이다.
function seriesOf({ id, rule }: ClearContent): string {
  if (rule.type === 'clear') {
    return `clear/${rule.name}`
  }

  return `content/${id}`
}

// 종류마다 첫 출시일이 가장 늦은 묶음이 최신이다.
export function toLatestContents(
  contents: readonly ClearContent[] = CLEAR_CONTENTS
): ClearContent[] {
  const seriesReleases = new Map<string, number>()
  for (const content of contents) {
    const series = seriesOf(content)
    const releasedAt = content.releasedAt.getTime()
    seriesReleases.set(series, Math.min(seriesReleases.get(series) ?? releasedAt, releasedAt))
  }
  const latestReleases = new Map<ContentClearKind, number>()
  for (const content of contents) {
    const firstReleasedAt = seriesReleases.get(seriesOf(content)) ?? 0
    latestReleases.set(
      content.kind,
      Math.max(latestReleases.get(content.kind) ?? firstReleasedAt, firstReleasedAt)
    )
  }

  return contents.filter(
    (content) => seriesReleases.get(seriesOf(content)) === latestReleases.get(content.kind)
  )
}
