import ky, { isTimeoutError } from 'ky'
import { z } from 'zod'
import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import {
  classifyNeopleUpstreamFailure,
  neopleStatusFailureKind
} from '../../errors/neople-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import { formatSeoulTime, parseSeoulTime } from '../../utils/seoul-time.js'
import type { CharacterIdentity } from '../details/sections.js'
import { TimelineFailure } from './errors.js'
import type { TimelineRange } from './ranges.js'
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
const ROW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

const seoulMinute = z
  .string()
  .regex(ROW_DATE_PATTERN)
  .transform((date) => parseSeoulTime(date, ROW_DATE_FORMAT))
  .pipe(z.date())

const timelineRowSchema = z
  .object({
    code: z.int().refine(isTimelineCode),
    name: z.string(),
    date: seoulMinute,
    data: z.record(z.string(), z.unknown())
  })
  .transform(({ code, name, date, data }): TimelineRow => ({ code, occurredAt: date, name, data }))

const timelinePageSchema = z.object({
  timeline: z.object({
    rows: z.array(timelineRowSchema),
    next: z
      .string()
      .nullish()
      .transform((next) => next ?? null)
  })
})

type TimelinePage = z.infer<typeof timelinePageSchema>['timeline']

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
  const parsed = timelinePageSchema.safeParse(body)
  if (!parsed.success) {
    throw new TimelineFailure('api')
  }

  return parsed.data.timeline
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
      startDate: formatSeoulTime(range.start, REQUEST_DATE_FORMAT),
      endDate: formatSeoulTime(range.end, REQUEST_DATE_FORMAT)
    }
    const rows: TimelineRow[] = []
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
