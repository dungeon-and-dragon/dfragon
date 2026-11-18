import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import type {
  CharacterDiscoveryPorts,
  FameSearchTarget,
  FetchedFamePage
} from '#application/character-collection/ports.js'
import {
  CharacterCollectionFailure,
  FAME_SEARCH_LIMIT,
  type FameWindow
} from '#domain/character-collection/index.js'

type FameSearchNeople = Pick<NeopleClient, 'servers' | 'jobs' | 'charactersFame'>

const ALL_SERVERS = 'all'

async function requestList<Result>(request: () => Promise<Result>): Promise<Result> {
  try {
    return await request()
  } catch (error) {
    if (error instanceof NeopleRequestFailure) {
      throw new CharacterCollectionFailure(error.kind)
    }

    throw error
  }
}

async function readTargets(neople: FameSearchNeople): Promise<FameSearchTarget[]> {
  const [{ rows: servers }, { rows: jobs }] = await requestList(() =>
    Promise.all([neople.servers(), neople.jobs()])
  )

  return servers.flatMap(({ serverId }) =>
    jobs.flatMap(({ jobId, rows }) => rows.map(({ jobGrowId }) => ({ serverId, jobId, jobGrowId })))
  )
}

async function readTopFame(neople: FameSearchNeople): Promise<number> {
  const { rows } = await requestList(() =>
    neople.charactersFame(ALL_SERVERS, { limit: FAME_SEARCH_LIMIT })
  )

  if (rows.length === 0) {
    throw new CharacterCollectionFailure('api')
  }

  return Math.max(...rows.map(({ fame }) => fame))
}

async function fetchFamePage(
  neople: FameSearchNeople,
  { serverId, jobId, jobGrowId }: FameSearchTarget,
  window: FameWindow
): Promise<FetchedFamePage> {
  try {
    const { rows } = await neople.charactersFame(serverId, {
      ...window,
      jobId,
      jobGrowId,
      // 1차 전직 ID 하나로 각성한 전직까지 함께 받는다.
      isAllJobGrow: true,
      limit: FAME_SEARCH_LIMIT
    })
    const characters = rows.map(({ characterId, fame }) => ({ characterId, fame }))

    return { status: 'fetched', characters }
  } catch (error) {
    if (!(error instanceof NeopleRequestFailure)) {
      throw error
    }

    if (error.kind === 'unavailable' || error.kind === 'timeout') {
      return { status: 'unavailable' }
    }

    return { status: 'failed' }
  }
}

export function createNeopleFameSearch(
  neople: FameSearchNeople
): Pick<CharacterDiscoveryPorts, 'readTargets' | 'readTopFame' | 'fetchFamePage'> {
  return {
    readTargets: () => readTargets(neople),
    readTopFame: () => readTopFame(neople),
    fetchFamePage: (target, window) => fetchFamePage(neople, target, window)
  }
}
