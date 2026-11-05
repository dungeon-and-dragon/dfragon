import type { SkillWindowCatalog } from '@dfragon/client-core/shared/search/skill-window'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

const CATALOG_KEY = 'skill-window'

export function useSkillWindowCatalog(): LoadedResult<SkillWindowCatalog | null> {
  const { getSkillWindowCatalog } = useClientHost()

  return useLoadedResult(CATALOG_KEY, getSkillWindowCatalog)
}
