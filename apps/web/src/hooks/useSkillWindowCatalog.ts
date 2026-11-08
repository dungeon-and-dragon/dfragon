import type { SkillWindowCatalog } from '#core/catalog/skill-window'
import { useClientHost } from '../host/client-host'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useSkillWindowCatalog(
  jobName: string | null
): LoadedResult<SkillWindowCatalog | null> {
  const { getSkillWindowCatalog } = useClientHost()

  return useLoadedResult(['skill-window', jobName], async () => {
    if (jobName === null) {
      return null
    }

    return getSkillWindowCatalog(jobName)
  })
}
