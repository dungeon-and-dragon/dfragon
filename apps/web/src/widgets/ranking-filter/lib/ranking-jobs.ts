import {
  RANKING_JOBS,
  type RankingGrow,
  type RankingJob,
  withMaleCrusaderRole
} from '#entities/character'
import type { FameRankingFilter } from '#entities/ranking'

export function growLabel({ name, role }: RankingGrow): string {
  return withMaleCrusaderRole(name, role ?? null)
}

export function growFilter(job: RankingJob, { jobGrowId, role }: RankingGrow): FameRankingFilter {
  return { jobId: job.jobId, jobGrowId, ...(role !== undefined && { role }) }
}

function isGrowSelected(grow: RankingGrow, filter: FameRankingFilter): boolean {
  return grow.jobGrowId === filter.jobGrowId && grow.role === filter.role
}

// 딜러, 버퍼 칩은 같은 전직 ID라 목록 이름에 전직과 역할까지 써서 구분한다. 다른 전직 칩은 직업 이름만 쓴다.
function jobNameOf(filter: FameRankingFilter): string | null {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === filter.jobId)
  if (job === undefined) {
    return null
  }

  const roleGrow =
    filter.role !== undefined ? job.grows.find((grow) => isGrowSelected(grow, filter)) : undefined
  if (roleGrow === undefined) {
    return job.name
  }

  return `${job.name} ${growLabel(roleGrow)}`
}

export function rankingName(filter: FameRankingFilter, setLabel: string | null = null): string {
  const parts = [jobNameOf(filter), setLabel, '검색 결과'].filter((part) => part !== null)

  return parts.join(' ')
}
