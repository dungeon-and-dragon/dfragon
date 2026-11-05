import {
  type DatabaseConfiguration,
  createDatabaseClient,
  readAdventureCharacters,
  readGuild,
  recordCharacterBasic
} from '@dfragon/database'
import { type NeopleClient, createNeopleClient } from '@dfragon/neople'
import { createCatalogService } from '../characters/catalog/service.js'
import { createNeopleCatalog } from '../characters/catalog/neople.js'
import { createNeopleCharacterSearch } from '../characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../characters/details/neople.js'
import { createNeopleCharacterTimeline } from '../characters/timeline/neople.js'
import { createDatabaseTimelineStore } from '../characters/timeline/store.js'
import { readCharacterTimeline } from '../characters/timeline/read.js'
import { syncCharacterTimeline } from '../characters/timeline/sync.js'
import { createNeopleShopGrade } from '../today-grade/neople.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../http.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

function createDatabaseSubscribers(
  neople: NeopleClient,
  database: DatabaseConfiguration | undefined
): Pick<ApiHttpAppOptions, 'timeline' | 'recordCharacterBasic' | 'adventureGuild'> {
  if (database === undefined) {
    return {}
  }
  const client = createDatabaseClient(database)
  const fetchTimeline = createNeopleCharacterTimeline(neople)
  const store = createDatabaseTimelineStore(client)

  // 두 구독자가 client 하나를 함께 쓰며, 타임라인 구독자가 종료 때 닫는다.

  return {
    timeline: {
      sync: (character) => syncCharacterTimeline(character, { fetchTimeline, store }),
      read: (character) => readCharacterTimeline(client, character, new Date()),
      close: () => client.$disconnect()
    },
    recordCharacterBasic: (basic) => recordCharacterBasic(client, basic),
    adventureGuild: {
      readAdventureCharacters: (adventureName) => readAdventureCharacters(client, adventureName),
      readGuild: (guildId) => readGuild(client, guildId)
    }
  }
}

export function createApiRuntime(configuration: RuntimeConfiguration) {
  const neople = createNeopleClient(configuration.apiKey)

  return createApiHttpApp({
    search: { searchCharacters: createNeopleCharacterSearch(neople) },
    details: {
      fetchDetails: createNeopleCharacterDetails(neople),
      catalog: createCatalogService(createNeopleCatalog(neople))
    },
    ...createDatabaseSubscribers(neople, configuration.database),
    todayGrade: { fetchShopGrade: createNeopleShopGrade(neople) },
    webDevOrigins: configuration.webDevOrigins,
    trustedProxyHops: configuration.trustedProxyHops,
    httpsOptions: configuration.localHttps,
    scoreLibraryPath: configuration.scoreLibraryPath
  })
}
