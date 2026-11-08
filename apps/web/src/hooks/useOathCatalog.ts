import type { OathCatalog } from '#core/shared/search/oath-catalog'
import { useClientHost } from '../host/client-host'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useOathCatalog(): LoadedResult<OathCatalog | null> {
  const { getOathCatalog } = useClientHost()

  return useLoadedResult(['oath-catalog'], getOathCatalog)
}
