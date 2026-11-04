import { isRecord } from '@dfragon/lib/utils/shape-check'
import ky, { isTimeoutError } from 'ky'
import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import {
  classifyNeopleUpstreamFailure,
  neopleStatusFailureKind
} from '../../errors/neople-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import type { CharacterIdentity } from '../details/sections.js'
import { TimelineFailure } from './errors.js'
import type { TimelineRange } from './ranges.js'
import {
  type NeopleTimelineRow,
  TIMELINE_CODES,
  type TimelineInputs,
  formatSeoulMinute,
  parseTimelineRow,
  toTimelineInputs
} from './rows.js'

const PAGE_LIMIT = 100
// 문서에 code를 빼면 모든 코드가 온다는 설명이 없어 저장할 코드를 모두 적는다.
const TIMELINE_CODE_QUERY = TIMELINE_CODES.join(',')

type TimelinePage = { rows: NeopleTimelineRow[]; next: string | null }

export type FetchCharacterTimeline = (
  identity: CharacterIdentity,
  range: TimelineRange
) => Promise<TimelineInputs>

interface TransportDependencies {
  fetch?: FetchTransport
  origin: string
}

function parseBody(rawBody: string, status: number): unknown {
  try {
    return JSON.parse(rawBody) as unknown
  } catch (error) {
    throw new TimelineFailure(neopleStatusFailureKind(status), { cause: error })
  }
}

function validateTimelinePage(body: unknown): TimelinePage {
  const timeline = isRecord(body) ? body.timeline : undefined
  if (
    !isRecord(timeline) ||
    !Array.isArray(timeline.rows) ||
    (timeline.next != null && typeof timeline.next !== 'string')
  ) {
    throw new TimelineFailure('api')
  }

  const rows = timeline.rows.map(parseTimelineRow)
  const next: string | null = timeline.next ?? null

  return { rows, next }
}

function makeAdapter(apiKey: string, deps: TransportDependencies): FetchCharacterTimeline {
  const neople = ky.create({
    baseUrl: deps.origin,
    fetch: deps.fetch,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0,
    throwHttpErrors: false
  })

  return async (identity, range) => {
    const path = `/df/servers/${encodeURIComponent(identity.serverId)}/characters/${encodeURIComponent(identity.characterId)}/timeline`
    const firstQuery = {
      limit: PAGE_LIMIT,
      code: TIMELINE_CODE_QUERY,
      startDate: formatSeoulMinute(range.start),
      endDate: formatSeoulMinute(range.end)
    }
    const rows: NeopleTimelineRow[] = []
    try {
      let next: string | null = null
      do {
        const page: TimelinePage = await neople
          .get(path, {
            // Neople applies the first request's limit, code and dates to every next page.
            searchParams: next !== null ? { next } : firstQuery,
            parseJson: (rawBody, { response }) => {
              const body = parseBody(rawBody, response.status)
              const failure = classifyNeopleUpstreamFailure(body, response.status, response.ok)
              if (failure) {
                throw new TimelineFailure(failure)
              }

              return validateTimelinePage(body)
            }
          })
          .json<TimelinePage>()
        rows.push(...page.rows)
        next = page.next
      } while (next !== null)

      return toTimelineInputs(rows)
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new TimelineFailure('timeout')
      }

      if (error instanceof TimelineFailure) {
        throw error
      }
      throw new TimelineFailure('api', { cause: error })
    }
  }
}

export function createNeopleCharacterTimeline(apiKey: string): FetchCharacterTimeline {
  return makeAdapter(apiKey, { origin: NEOPLE_ORIGIN })
}

export function createNeopleCharacterTimelineForTest(
  apiKey: string,
  deps: Partial<TransportDependencies>
): FetchCharacterTimeline {
  return makeAdapter(apiKey, { origin: NEOPLE_ORIGIN, ...deps })
}
