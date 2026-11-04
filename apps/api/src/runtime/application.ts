import { type DatabaseConfiguration, createDatabaseClient } from '@dfragon/database'
import { type NeopleClient, createNeopleClient } from '@dfragon/neople'
import { createCatalogService } from '../characters/catalog/service.js'
import { createNeopleCatalog } from '../characters/catalog/neople.js'
import { createNeopleCharacterSearch } from '../characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../characters/details/neople.js'
import { createNeopleCharacterTimeline } from '../characters/timeline/neople.js'
import { createDatabaseTimelineStore } from '../characters/timeline/store.js'
import { syncCharacterTimeline } from '../characters/timeline/sync.js'
import { createNeopleShopGrade } from '../today-grade/neople.js'
import { type TimelineSyncOptions, createApiHttpApp } from '../http.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

function createTimelineSync(
  neople: NeopleClient,
  database: DatabaseConfiguration | undefined
): TimelineSyncOptions | undefined {
  if (database === undefined) {
    return undefined
  }
  const client = createDatabaseClient(database)
  const fetchTimeline = createNeopleCharacterTimeline(neople)
  const store = createDatabaseTimelineStore(client)

  return {
    sync: (character) => syncCharacterTimeline(character, { fetchTimeline, store }),
    close: () => client.$disconnect()
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
    timeline: createTimelineSync(neople, configuration.database),
    todayGrade: { fetchShopGrade: createNeopleShopGrade(neople) },
    webDevOrigins: configuration.webDevOrigins,
    trustedProxyHops: configuration.trustedProxyHops,
    httpsOptions: configuration.localHttps,
    scoreLibraryPath: configuration.scoreLibraryPath
  })
}
