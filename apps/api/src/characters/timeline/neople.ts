import ky, { isTimeoutError } from 'ky'
import { z } from 'zod'
import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import {
  classifyNeopleUpstreamFailure,
  neopleStatusFailureKind
} from '../../errors/neople-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import type { CharacterIdentity } from '../details/sections.js'
import { TimelineFailure } from './errors.js'
import type { TimelineRange } from './ranges.js'
import { TIMELINE_CODES, type TimelineInputs, type TimelineRow, toTimelineInputs } from './rows.js'

const PAGE_LIMIT = 100
// 문서에 code를 빼면 모든 코드가 온다는 설명이 없어 저장할 코드를 모두 적는다.
const TIMELINE_CODE_QUERY = TIMELINE_CODES.join(',')

// Asia/Seoul은 1988년 이후 일광 절약 시간이 없어 수집 범위 전체가 UTC+9다.
const SEOUL_OFFSET_MS = 9 * 60 * 60_000

function formatSeoulMinute(date: Date): string {
  const seoul = new Date(date.getTime() + SEOUL_OFFSET_MS).toISOString()

  return `${seoul.slice(0, 4)}${seoul.slice(5, 7)}${seoul.slice(8, 10)}T${seoul.slice(11, 13)}${seoul.slice(14, 16)}`
}

const ROW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

const seoulMinute = z
  .string()
  .regex(ROW_DATE_PATTERN)
  .transform((date) => new Date(`${date.replace(' ', 'T')}:00+09:00`))
  .refine((date) => !Number.isNaN(date.getTime()))

const timelineRowSchema = z
  .object({
    code: z.int().min(100).max(699),
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
      startDate: formatSeoulMinute(range.start),
      endDate: formatSeoulMinute(range.end)
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
