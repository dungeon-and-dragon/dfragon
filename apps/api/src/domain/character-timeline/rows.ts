import type { TimelineEventInput, TimelineItemInput } from '@dfragon/database'
import { groupBy } from 'remeda'

// https://developers.neople.co.kr/contents/guide/pages/all#던파-타임라인-코드
// 캐릭터, 던전, 결투장 기록은 timeline_events에 저장한다.
const TIMELINE_EVENT_CODES = [
  101, 102, 103, 104, 105, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 301
] as const

// 강화, 획득, 서약, 룬과 탈리스만 기록은 timeline_items에 저장한다.
const TIMELINE_ITEM_CODES = [
  401, 402, 403, 404, 405, 406, 407, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512,
  513, 514, 515, 516, 517, 518, 519, 520, 521, 550, 551, 552, 553, 554, 555, 556, 557, 601, 602
] as const

export const TIMELINE_CODES = [...TIMELINE_EVENT_CODES, ...TIMELINE_ITEM_CODES] as const

type TimelineTable = 'events' | 'items'

const TIMELINE_TABLE_BY_CODE: ReadonlyMap<number, TimelineTable> = new Map([
  ...TIMELINE_EVENT_CODES.map((code) => [code, 'events'] as const),
  ...TIMELINE_ITEM_CODES.map((code) => [code, 'items'] as const)
])

export function isTimelineCode(code: number): boolean {
  return TIMELINE_TABLE_BY_CODE.has(code)
}

// 응답 schema가 표에 있는 코드만 통과시키므로 여기서는 늘 찾는다.
function tableOf(row: TimelineRow): TimelineTable {
  return TIMELINE_TABLE_BY_CODE.get(row.code)!
}

export type TimelineInputs = { events: TimelineEventInput[]; items: TimelineItemInput[] }

export type TimelineRow = {
  code: number
  occurredAt: Date
  name: string
  data: Record<string, unknown>
}

function stringField(data: Record<string, unknown>, field: string): string | null {
  const value = data[field]
  if (typeof value === 'string') {
    return value
  }

  return null
}

function toEventInput({ code, occurredAt, name, data }: TimelineRow): TimelineEventInput {
  return { code, occurredAt, name, raidName: stringField(data, 'raidName'), data }
}

function toItemInput({ code, occurredAt, name, data }: TimelineRow): TimelineItemInput {
  return {
    code,
    occurredAt,
    name,
    itemId: stringField(data, 'itemId'),
    itemName: stringField(data, 'itemName'),
    itemRarity: stringField(data, 'itemRarity'),
    data
  }
}

export function toTimelineInputs(rows: readonly TimelineRow[]): TimelineInputs {
  const { events = [], items = [] } = groupBy(rows, tableOf)
  const eventInputs = events.map(toEventInput)
  const itemInputs = items.map(toItemInput)

  return { events: eventInputs, items: itemInputs }
}
