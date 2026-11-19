import { z } from 'zod'
import { maleCrusaderRoleSchema } from '#core/character'
import {
  type FameRankingFilter,
  type FameRankingSetFilter,
  ITEM_FILTER_LIMIT,
  type SetStatsFilter
} from '#core/ranking'
import { growFilter, RANKING_JOBS } from './ranking-jobs'

const text = z.string().min(1).optional().catch(undefined)

// 주소에는 itemIds를 API query와 같이 쉼표로 이어 둔다.
export type RankingSearch = Omit<FameRankingFilter, 'itemIds'> & { itemIds?: string }

// 빈 항목과 중복은 버리고, 여섯 개 이상이면 아이템 필터를 모두 버린다.
const itemIdsSchema = z
  .union([z.string(), z.number()])
  .transform((value) => [
    ...new Set(
      String(value)
        .split(',')
        .filter((itemId) => itemId !== '')
    )
  ])
  .pipe(z.array(z.string()).min(1).max(ITEM_FILTER_LIMIT))
  .optional()
  .catch(undefined)

const searchSchema = z.object({
  jobId: z.string().optional().catch(undefined),
  jobGrowId: z.string().optional().catch(undefined),
  role: maleCrusaderRoleSchema.optional().catch(undefined),
  equipmentSetId: text,
  oathSetId: z.coerce.number().int().positive().optional().catch(undefined),
  oathSetOption: text,
  itemIds: itemIdsSchema
})

function jobFilterOf({ jobId, jobGrowId, role }: z.infer<typeof searchSchema>): SetStatsFilter {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)
  if (job === undefined) {
    return {}
  }

  // role을 받지 않는 전직이면 role만 버린다. 남성 크루세이더는 역할 없는 칩이 없어 역할을 모르면 직업 랭킹을 연다.
  const sameGrow = job.grows.filter((grow) => grow.jobGrowId === jobGrowId)
  const grow =
    sameGrow.find((candidate) => candidate.role === role) ??
    sameGrow.find((candidate) => candidate.role === undefined)
  if (grow === undefined) {
    return { jobId: job.jobId }
  }

  return growFilter(job, grow)
}

// API는 서약 세트 없이 선택지만 받지 않으므로 그때는 선택지를 버린다.
function setFilterOf({
  equipmentSetId,
  oathSetId,
  oathSetOption
}: z.infer<typeof searchSchema>): FameRankingSetFilter {
  return {
    ...(equipmentSetId !== undefined && { equipmentSetId }),
    ...(oathSetId !== undefined && { oathSetId }),
    ...(oathSetId !== undefined && oathSetOption !== undefined && { oathSetOption })
  }
}

function itemFilterOf({ itemIds }: z.infer<typeof searchSchema>): RankingSearch {
  if (itemIds === undefined) {
    return {}
  }

  return { itemIds: itemIds.join(',') }
}

export function parseRankingSearch(search: Record<string, unknown>): RankingSearch {
  const parsed = searchSchema.parse(search)
  const items = itemFilterOf(parsed)
  const jobFilter = jobFilterOf(parsed)
  const setFilter = setFilterOf(parsed)

  return { ...jobFilter, ...setFilter, ...items }
}

export function rankingFilterOf({ itemIds, ...rest }: RankingSearch): FameRankingFilter {
  if (itemIds === undefined) {
    return rest
  }

  return { ...rest, itemIds: itemIds.split(',') }
}

export function rankingSearchOf({ itemIds, ...rest }: FameRankingFilter): RankingSearch {
  if (itemIds === undefined || itemIds.length === 0) {
    return rest
  }

  return { ...rest, itemIds: itemIds.join(',') }
}

export function parseJobSearch(search: Record<string, unknown>): SetStatsFilter {
  return jobFilterOf(searchSchema.parse(search))
}
