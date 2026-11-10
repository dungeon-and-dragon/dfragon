import type { SkillStats, SkillStatsJob } from '#core/ranking/skill-stats'
import { useClientHost } from '../../../host/client-host'
import { type LoadedResult, useLoadedResult } from '../../../hooks/useLoadedResult'

export function useSkillStats(job: SkillStatsJob): LoadedResult<SkillStats> {
  const { getSkillStats } = useClientHost()

  return useLoadedResult(['skill-stats', job.jobId, job.jobGrowId, job.role], () =>
    getSkillStats(job)
  )
}
