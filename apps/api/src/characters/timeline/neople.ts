import type { TimelineRange } from '@dfragon/database'
import { type NeopleClient, NeopleRequestFailure, type NeopleTimelineRow } from '@dfragon/neople'
import { forwardCause } from '../../error-chain.js'
import { formatSeoulTime, parseSeoulTime } from '../../utils/seoul-time.js'
import type { CharacterIdentity } from '../details/sections.js'
import { TimelineFailure } from './errors.js'
import {
  TIMELINE_CODES,
  type TimelineInputs,
  type TimelineRow,
  isTimelineCode,
  toTimelineInputs
} from './rows.js'

const PAGE_LIMIT = 100
// 문서에 code를 빼면 모든 코드가 온다는 설명이 없어 저장할 코드를 모두 적는다.
const TIMELINE_CODE_QUERY = TIMELINE_CODES.join(',')

const REQUEST_DATE_FORMAT = "yyyyMMdd'T'HHmm"
const ROW_DATE_FORMAT = 'yyyy-MM-dd HH:mm'

export type FetchCharacterTimeline = (
  identity: CharacterIdentity,
  range: TimelineRange
) => Promise<TimelineInputs>

function toTimelineRow({ code, name, date, data }: NeopleTimelineRow): TimelineRow {
  if (!isTimelineCode(code)) {
    throw new TimelineFailure('api')
  }
  const occurredAt = parseSeoulTime(date, ROW_DATE_FORMAT)
  if (occurredAt === null) {
    throw new TimelineFailure('api')
  }
  const rowData: TimelineRow['data'] = data ?? {}

  return { code, occurredAt, name, data: rowData }
}

export function createNeopleCharacterTimeline(neople: NeopleClient): FetchCharacterTimeline {
  return async (identity, range) => {
    const firstQuery = {
      limit: PAGE_LIMIT,
      code: TIMELINE_CODE_QUERY,
      startDate: formatSeoulTime(range.start, REQUEST_DATE_FORMAT),
      endDate: formatSeoulTime(range.end, REQUEST_DATE_FORMAT)
    }
    const rows: TimelineRow[] = []
    try {
      let next: string | null = null
      do {
        const query = next !== null ? { next } : firstQuery
        const { timeline } = await neople.characterTimeline(identity, query)
        rows.push(...timeline.rows.map(toTimelineRow))
        next = timeline.next ?? null
      } while (next !== null)

      return toTimelineInputs(rows)
    } catch (error) {
      if (error instanceof NeopleRequestFailure) {
        throw new TimelineFailure(error.kind, forwardCause(error))
      }

      if (error instanceof TimelineFailure) {
        throw error
      }
      throw new TimelineFailure('api', { cause: error })
    }
  }
}
