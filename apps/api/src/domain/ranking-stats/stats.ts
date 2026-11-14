import type { CharacterStats } from '@dfragon/database'

export const FAME_RANKING_LIMIT = 100

export function roundAverageFame({ jobs, ...counts }: CharacterStats): CharacterStats {
  const roundedJobs = jobs.map(({ averageFame, ...job }) => {
    const roundedFame = averageFame !== null ? Math.round(averageFame) : null

    return { ...job, averageFame: roundedFame }
  })

  return { ...counts, jobs: roundedJobs }
}
