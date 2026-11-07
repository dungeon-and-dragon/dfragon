import { z } from 'zod'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity
} from '../../preload/common/types/character'
import type { TodayGrade } from '../../preload/common/types/today-grade'
import {
  adventureCharactersSchema,
  guildSchema,
  type AdventureCharacters,
  type Guild
} from '../adventure-guild/adventure-guild'
import {
  adventureActivityDaySchema,
  adventureActivitySchema,
  activitySeasonSchema,
  type ActivitySeason,
  type AdventureActivity,
  type AdventureActivityDay
} from '../adventure-guild/adventure-activity'
import { adventureWeeklySchema, type AdventureWeekly } from '../adventure-guild/adventure-weekly'
import {
  characterStatsSchema,
  fameRankingSchema,
  type CharacterStats,
  type FameRanking,
  type FameRankingFilter
} from '../ranking/ranking-stats'
import {
  characterDetailViewSchema,
  type CharacterDetailView
} from '../search/character-detail-view'
import {
  characterTimelineSchema,
  timelineAcquisitionPageSchema,
  timelineEnhancementPageSchema,
  type CharacterTimeline,
  type TimelineAcquisition,
  type TimelineEnhancement,
  type TimelinePage
} from '../search/character-timeline'
import { SearchHttpFailure } from '../search/http'
import {
  assertApiSuccess,
  createCharacterHttpClient,
  parseCharacterJson,
  throwCharacterTransportFailure
} from './api-response'
import {
  ALL_CHARACTER_SERVERS,
  candidatesSchema,
  type CharacterSearchQuery,
  detailsSchema,
  type SearchedCharacter,
  validateIdentity,
  validateNickname,
  validateSearchQuery
} from './character-schemas'

export type IdentityRequest = CharacterIdentity & { signal: AbortSignal }
export type CharacterCandidatesHttp = (input: {
  nickname: string
  signal: AbortSignal
}) => Promise<readonly CharacterCandidate[]>
export type CharacterSearchHttp = (
  query: CharacterSearchQuery
) => Promise<readonly SearchedCharacter[]>
export type CharacterPngHttp = (input: IdentityRequest) => Promise<Uint8Array>
export type CharacterDetailsHttp = (input: IdentityRequest) => Promise<CharacterDetails>
export type CharacterDetailViewHttp = (identity: CharacterIdentity) => Promise<CharacterDetailView>
export type CharacterTimelineHttp = (identity: CharacterIdentity) => Promise<CharacterTimeline>
export type TimelinePageHttp<Item> = (
  identity: CharacterIdentity,
  before: string
) => Promise<TimelinePage<Item>>
export type FameRankingHttp = (filter: FameRankingFilter) => Promise<FameRanking>
export type CharacterStatsHttp = () => Promise<CharacterStats>
export type AdventureCharactersHttp = (adventureName: string) => Promise<AdventureCharacters>
export type GuildHttp = (guildId: string) => Promise<Guild>
export type AdventureWeeklyHttp = (adventureName: string) => Promise<AdventureWeekly>
export type AdventureActivityHttp = (
  adventureName: string,
  season: number | undefined
) => Promise<AdventureActivity>
export type AdventureActivityDayHttp = (
  adventureName: string,
  date: string
) => Promise<AdventureActivityDay>
export type AdventureSeasonBackfillHttp = (
  adventureName: string,
  season: number
) => Promise<ActivitySeason>
export type TodayGradeHttp = () => Promise<TodayGrade>

export type DfragonClient = Readonly<{
  characters: Readonly<{
    search: CharacterSearchHttp
    candidates: CharacterCandidatesHttp
    image: CharacterPngHttp
    details: CharacterDetailsHttp
    detailView: CharacterDetailViewHttp
    timeline: CharacterTimelineHttp
    timelineEnhancements: TimelinePageHttp<TimelineEnhancement>
    timelineAcquisitions: TimelinePageHttp<TimelineAcquisition>
  }>
  rankings: Readonly<{ fame: FameRankingHttp }>
  stats: CharacterStatsHttp
  adventures: Readonly<{
    characters: AdventureCharactersHttp
    weekly: AdventureWeeklyHttp
    activity: AdventureActivityHttp
    activityDay: AdventureActivityDayHttp
    backfillSeason: AdventureSeasonBackfillHttp
  }>
  guilds: Readonly<{ get: GuildHttp }>
  items: Readonly<{ todayGrade: TodayGradeHttp }>
}>

type JsonRequestOptions = {
  method?: 'get' | 'post'
  searchParams?: Record<string, string>
  signal?: AbortSignal
  details?: boolean
}

const CHARACTER_SEARCH_LIMIT = '200'

const todayGradeSchema = z.object({
  percent: z.number().int().min(0).max(100),
  // 화면은 Date.parse로 만료 시각을 읽으므로 ISO 형식으로 좁히지 않고 Date.parse가 읽는지만 본다.
  expiresAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)))
})

function characterPath({ serverId, characterId }: CharacterIdentity): string {
  return `/characters/${serverId}/${characterId}`
}

function sameIdentity(
  character: CharacterIdentity,
  { serverId, characterId }: CharacterIdentity
): boolean {
  return character.serverId === serverId && character.characterId === characterId
}

function createJsonRequest(
  http: ReturnType<typeof createCharacterHttpClient>,
  apiOrigin: string
): <Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options?: JsonRequestOptions
) => Promise<z.infer<Schema>> {
  return async (path, schema, { method = 'get', searchParams, signal, details = true } = {}) => {
    try {
      signal?.throwIfAborted()
      const request = http(`${apiOrigin}${path}`, {
        method,
        searchParams,
        headers: { Accept: 'application/json' },
        signal
      })
      const response = await request
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다. await한 Response의 본문을 직접 읽으면 대기 상한이 없다.
      const body = parseCharacterJson(await request.arrayBuffer())
      assertApiSuccess(response, body, details)
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal?.throwIfAborted()

      return parsed.data
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

export function createDfragonClient({
  apiOrigin,
  fetch: transport
}: {
  apiOrigin: string
  fetch: typeof fetch
}): DfragonClient {
  const http = createCharacterHttpClient(transport)
  const requestJson = createJsonRequest(http, apiOrigin)

  async function image({ serverId, characterId, signal }: IdentityRequest): Promise<Uint8Array> {
    const identity = { serverId, characterId }
    validateIdentity(identity)
    try {
      signal.throwIfAborted()
      const request = http.get(`${apiOrigin}${characterPath(identity)}/image`, {
        headers: { Accept: 'image/png' },
        signal
      })
      const response = await request
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined)
        if (response.status === 429) {
          throw new SearchHttpFailure('SEARCH_RATE_LIMITED')
        }
        throw new SearchHttpFailure('NEOPLE_API_ERROR')
      }
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다.
      const bytes = new Uint8Array(await request.arrayBuffer())
      const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
      if (contentType !== 'image/png') {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal.throwIfAborted()

      return bytes
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }

  return {
    characters: {
      async search(query) {
        validateSearchQuery(query)
        const { rows } = await requestJson(
          '/characters',
          candidatesSchema.refine(
            ({ rows }) =>
              query.serverId === ALL_CHARACTER_SERVERS ||
              rows.every((row) => row.serverId === query.serverId)
          ),
          {
            searchParams: {
              characterName: query.characterName,
              serverId: query.serverId,
              limit: CHARACTER_SEARCH_LIMIT
            },
            details: false
          }
        )

        return rows
      },
      async candidates({ nickname, signal }) {
        validateNickname(nickname)
        const { rows } = await requestJson(
          '/characters/candidates',
          candidatesSchema.refine(({ rows }) =>
            rows.every((row) => row.characterName === nickname)
          ),
          { searchParams: { characterName: nickname }, signal, details: false }
        )

        return rows
      },
      image,
      async details({ serverId, characterId, signal }) {
        const identity = { serverId, characterId }
        validateIdentity(identity)

        return requestJson(
          characterPath(identity),
          detailsSchema.refine(({ character }) => sameIdentity(character, identity)),
          { signal }
        )
      },
      async detailView(identity) {
        validateIdentity(identity)

        return requestJson(
          characterPath(identity),
          characterDetailViewSchema.refine(({ character }) => sameIdentity(character, identity))
        )
      },
      async timeline(identity) {
        validateIdentity(identity)

        return requestJson(`${characterPath(identity)}/timeline`, characterTimelineSchema)
      },
      async timelineEnhancements(identity, before) {
        validateIdentity(identity)

        return requestJson(
          `${characterPath(identity)}/timeline/enhancements`,
          timelineEnhancementPageSchema,
          { searchParams: { before } }
        )
      },
      async timelineAcquisitions(identity, before) {
        validateIdentity(identity)

        return requestJson(
          `${characterPath(identity)}/timeline/acquisitions`,
          timelineAcquisitionPageSchema,
          { searchParams: { before } }
        )
      }
    },
    rankings: {
      async fame(filter) {
        if (filter.jobGrowId !== undefined && filter.jobId === undefined) {
          throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
        }

        return requestJson('/rankings/fame', fameRankingSchema, {
          searchParams: {
            ...(filter.jobId !== undefined && { jobId: filter.jobId }),
            ...(filter.jobGrowId !== undefined && { jobGrowId: filter.jobGrowId })
          }
        })
      }
    },
    stats: () => requestJson('/stats', characterStatsSchema),
    adventures: {
      characters: (adventureName) =>
        requestJson(
          `/adventures/${encodeURIComponent(adventureName)}/characters`,
          adventureCharactersSchema
        ),
      async weekly(adventureName) {
        if (adventureName.trim() === '') {
          throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
        }

        return requestJson(
          `/adventures/${encodeURIComponent(adventureName)}/weekly`,
          adventureWeeklySchema
        )
      },
      async activity(adventureName, season) {
        if (adventureName.trim() === '') {
          throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
        }

        return requestJson(
          `/adventures/${encodeURIComponent(adventureName)}/activity`,
          adventureActivitySchema,
          { searchParams: { ...(season !== undefined && { season: String(season) }) } }
        )
      },
      async activityDay(adventureName, date) {
        if (adventureName.trim() === '') {
          throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
        }

        return requestJson(
          `/adventures/${encodeURIComponent(adventureName)}/activity/days/${encodeURIComponent(date)}`,
          adventureActivityDaySchema
        )
      },
      async backfillSeason(adventureName, season) {
        if (adventureName.trim() === '') {
          throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
        }

        return requestJson(
          `/adventures/${encodeURIComponent(adventureName)}/activity/seasons/${season}/backfill`,
          activitySeasonSchema,
          { method: 'post' }
        )
      }
    },
    guilds: {
      get: (guildId) => requestJson(`/guilds/${encodeURIComponent(guildId)}`, guildSchema)
    },
    items: {
      todayGrade: () => requestJson('/items/today-grade', todayGradeSchema)
    }
  }
}
