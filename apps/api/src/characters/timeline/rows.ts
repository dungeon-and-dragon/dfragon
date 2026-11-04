import { isRecord } from '@dfragon/lib/utils/shape-check'
import { TimelineFailure } from './errors.js'

// https://developers.neople.co.kr/contents/guide/pages/all#던파-타임라인-코드
export const TIMELINE_CODES = [
  101, 102, 103, 104, 105, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 301, 401, 402, 403,
  404, 405, 406, 407, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515,
  516, 517, 518, 519, 520, 521, 550, 551, 552, 553, 554, 555, 556, 557, 601, 602
] as const

export type TimelineEventInput = {
  code: number
  occurredAt: Date
  name: string
  raidName: string | null
  data: Record<string, unknown>
}

export type TimelineItemInput = {
  code: number
  occurredAt: Date
  name: string
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  data: Record<string, unknown>
}

export type TimelineInputs = { events: TimelineEventInput[]; items: TimelineItemInput[] }

export type NeopleTimelineRow = {
  code: number
  name: string
  date: string
  data: Record<string, unknown>
}

const ROW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

export function parseTimelineRow(row: unknown): NeopleTimelineRow {
  if (
    !isRecord(row) ||
    typeof row.code !== 'number' ||
    !Number.isInteger(row.code) ||
    typeof row.name !== 'string' ||
    typeof row.date !== 'string' ||
    !ROW_DATE_PATTERN.test(row.date) ||
    !isRecord(row.data)
  ) {
    throw new TimelineFailure('api')
  }

  return { code: row.code, name: row.name, date: row.date, data: row.data }
}

// Asia/Seoul은 1988년 이후 일광 절약 시간이 없어 수집 범위 전체가 UTC+9다.
const SEOUL_OFFSET_MS = 9 * 60 * 60_000

function parseSeoulMinute(date: string): Date {
  const occurredAt = new Date(`${date.replace(' ', 'T')}:00+09:00`)
  if (Number.isNaN(occurredAt.getTime())) {
    throw new TimelineFailure('api')
  }

  return occurredAt
}

export function formatSeoulMinute(date: Date): string {
  const seoul = new Date(date.getTime() + SEOUL_OFFSET_MS).toISOString()

  return `${seoul.slice(0, 4)}${seoul.slice(5, 7)}${seoul.slice(8, 10)}T${seoul.slice(11, 13)}${seoul.slice(14, 16)}`
}

function stringField(data: Record<string, unknown>, field: string): string | null {
  const value = data[field]
  if (typeof value === 'string') {
    return value
  }

  return null
}

export function toTimelineInputs(rows: readonly NeopleTimelineRow[]): TimelineInputs {
  const inputs: TimelineInputs = { events: [], items: [] }
  for (const { code, name, date, data } of rows) {
    const occurredAt = parseSeoulMinute(date)
    if (code >= 100 && code < 400) {
      inputs.events.push({ code, occurredAt, name, raidName: stringField(data, 'raidName'), data })
    } else if (code >= 400 && code < 700) {
      inputs.items.push({
        code,
        occurredAt,
        name,
        itemId: stringField(data, 'itemId'),
        itemName: stringField(data, 'itemName'),
        itemRarity: stringField(data, 'itemRarity'),
        data
      })
    } else {
      throw new TimelineFailure('api')
    }
  }

  return inputs
}
