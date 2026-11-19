import type { SkillStats, SkillStatsJob } from '#core/ranking'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export function useSkillStats(job: SkillStatsJob): LoadedResult<SkillStats> {
  const { getSkillStats } = useClientHost()

  return useLoadedResult(['skill-stats', job.jobId, job.jobGrowId, job.role], () =>
    getSkillStats(job)
  )
}
