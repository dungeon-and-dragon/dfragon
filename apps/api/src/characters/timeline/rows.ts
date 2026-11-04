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

export function toTimelineInputs(rows: readonly TimelineRow[]): TimelineInputs {
  const inputs: TimelineInputs = { events: [], items: [] }
  for (const { code, occurredAt, name, data } of rows) {
    if (code < 400) {
      inputs.events.push({ code, occurredAt, name, raidName: stringField(data, 'raidName'), data })
    } else {
      inputs.items.push({
        code,
        occurredAt,
        name,
        itemId: stringField(data, 'itemId'),
        itemName: stringField(data, 'itemName'),
        itemRarity: stringField(data, 'itemRarity'),
        data
      })
    }
  }

  return inputs
}
