import {
  NEOPLE_CHARACTER_SECTIONS,
  type NeopleCharacterSection,
  auctionSchema,
  characterBasicSchema,
  characterSearchSchema,
  characterSectionSchemas,
  characterSkillStyleSchema,
  charactersFameSchema,
  itemSearchSchema,
  itemShopSchema,
  jobsSchema,
  multiItemsSchema,
  serversSchema,
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

// minFame을 비우면 Neople이 maxFame - 2000으로, maxFame을 비우면 게임 안 최고 명성으로 채운다.
export interface CharactersFameQuery {
  minFame?: number
  maxFame?: number
  jobId?: string
  jobGrowId?: string
  isAllJobGrow?: boolean
  limit: number
}

export interface AuctionQuery {
  itemName: string
  wordType: 'match'
  sort: 'unitPrice:asc'
  limit: number
}

export interface ItemSearchQuery {
  itemName: string
  wordType: 'match'
  limit: number
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
    servers: () => transport.get('/df/servers', serversSchema),
    jobs: () => transport.get('/df/jobs', jobsSchema),
    searchCharacters: (serverId: string, query: CharacterSearchQuery) =>
      transport.get(
        `/df/servers/${encodeURIComponent(serverId)}/characters`,
        characterSearchSchema,
        { searchParams: { ...query } }
      ),
    charactersFame: (serverId: string, query: CharactersFameQuery) =>
      transport.get(
        `/df/servers/${encodeURIComponent(serverId)}/characters-fame`,
        charactersFameSchema,
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
    characterSkillStyle: (identity: NeopleCharacterIdentity) =>
      transport.get(
        `${characterPath(identity)}${NEOPLE_CHARACTER_SECTIONS.skill_style.path}`,
        characterSkillStyleSchema
      ),
    characterTimeline: (identity: NeopleCharacterIdentity, query: CharacterTimelineQuery) =>
      transport.get(`${characterPath(identity)}/timeline`, timelinePageSchema, {
        searchParams: { ...query }
      }),
    multiItems: (itemIds: readonly string[], signal?: AbortSignal) =>
      transport.get('/df/multi/items', multiItemsSchema, {
        signal,
        searchParams: { itemIds: itemIds.join(',') }
      }),
    searchItems: (query: ItemSearchQuery) =>
      transport.get('/df/items', itemSearchSchema, { searchParams: { ...query } }),
    itemShop: (itemId: string, signal: AbortSignal) =>
      transport.get(`/df/items/${encodeURIComponent(itemId)}/shop`, itemShopSchema, { signal }),
    auction: (query: AuctionQuery) =>
      transport.get('/df/auction', auctionSchema, { searchParams: { ...query } }),
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
