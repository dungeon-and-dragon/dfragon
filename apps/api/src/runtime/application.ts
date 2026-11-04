import { type DatabaseConfiguration, createDatabaseClient } from '@dfragon/database'
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
  apiKey: string,
  database: DatabaseConfiguration | undefined
): TimelineSyncOptions | undefined {
  if (database === undefined) {
    return undefined
  }
  const client = createDatabaseClient(database)
  const fetchTimeline = createNeopleCharacterTimeline(apiKey)
  const store = createDatabaseTimelineStore(client)

  return {
    sync: (character) => syncCharacterTimeline(character, { fetchTimeline, store }),
    close: () => client.$disconnect()
  }
}

export function createApiRuntime(configuration: RuntimeConfiguration) {
  return createApiHttpApp({
    search: { searchCharacters: createNeopleCharacterSearch(configuration.apiKey) },
    details: {
      fetchDetails: createNeopleCharacterDetails(configuration.apiKey),
      catalog: createCatalogService(createNeopleCatalog(configuration.apiKey))
    },
    timeline: createTimelineSync(configuration.apiKey, configuration.database),
    todayGrade: { fetchShopGrade: createNeopleShopGrade(configuration.apiKey) },
    webDevOrigins: configuration.webDevOrigins,
    trustedProxyHops: configuration.trustedProxyHops,
    httpsOptions: configuration.localHttps,
    scoreLibraryPath: configuration.scoreLibraryPath
  })
}
