import {
  NEOPLE_CHARACTER_SECTIONS,
  type NeopleCharacterSection,
  characterBasicSchema,
  characterSearchSchema,
  characterSectionSchemas,
  itemShopSchema,
  multiItemsSchema,
  skillSchema,
  timelinePageSchema
} from './schemas.js'
import { type FetchTransport, type Transport, createTransport } from './transport.js'

export const NEOPLE_ORIGIN = 'https://api.neople.co.kr'

export interface NeopleCharacterIdentity {
  characterId: string
  serverId: string
}

export interface CharacterSearchQuery {
  characterName: string
  limit: number
  wordType: 'full' | 'match'
}

// Neople이 다음 페이지에도 첫 요청의 limit, code와 기간을 적용하므로 `next`만 보낸다.
export type CharacterTimelineQuery =
  | { limit: number; code: string; startDate: string; endDate: string }
  | { next: string }

export interface NeopleTestDependencies {
  fetch?: FetchTransport
  origin?: string
}

function characterPath({ serverId, characterId }: NeopleCharacterIdentity): string {
  return `/df/servers/${encodeURIComponent(serverId)}/characters/${encodeURIComponent(characterId)}`
}

function makeClient(transport: Transport) {
  return {
    searchCharacters: (serverId: string, query: CharacterSearchQuery) =>
      transport.get(
        `/df/servers/${encodeURIComponent(serverId)}/characters`,
        characterSearchSchema,
        { searchParams: { ...query } }
      ),
    character: (
      identity: NeopleCharacterIdentity,
      section: NeopleCharacterSection,
      signal: AbortSignal
    ) =>
      transport.get(
        `${characterPath(identity)}${NEOPLE_CHARACTER_SECTIONS[section].path}`,
        characterSectionSchemas[section],
        { signal }
      ),
    characterBasic: (identity: NeopleCharacterIdentity) =>
      transport.get(characterPath(identity), characterBasicSchema),
    characterTimeline: (identity: NeopleCharacterIdentity, query: CharacterTimelineQuery) =>
      transport.get(`${characterPath(identity)}/timeline`, timelinePageSchema, {
        searchParams: { ...query }
      }),
    multiItems: (itemIds: readonly string[], signal: AbortSignal) =>
      transport.get('/df/multi/items', multiItemsSchema, {
        signal,
        searchParams: { itemIds: itemIds.join(',') }
      }),
    itemShop: (itemId: string, signal: AbortSignal) =>
      transport.get(`/df/items/${encodeURIComponent(itemId)}/shop`, itemShopSchema, { signal }),
    skill: (jobId: string, skillId: string, signal: AbortSignal) =>
      transport.get(
        `/df/skills/${encodeURIComponent(jobId)}/${encodeURIComponent(skillId)}`,
        skillSchema,
        { signal }
      )
  }
}

export type NeopleClient = ReturnType<typeof makeClient>

export function createNeopleClient(apiKey: string): NeopleClient {
  return makeClient(createTransport(apiKey, { origin: NEOPLE_ORIGIN }))
}

export function createNeopleClientForTest(
  apiKey: string,
  deps: NeopleTestDependencies
): NeopleClient {
  return makeClient(createTransport(apiKey, { origin: NEOPLE_ORIGIN, ...deps }))
}
