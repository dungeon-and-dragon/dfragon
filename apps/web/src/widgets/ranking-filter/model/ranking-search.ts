import { SET_SAMPLES } from '@dfragon/lib'
import { z } from 'zod'
import { EVOLUTION_FILTER_LIMIT, ITEM_FILTER_LIMIT } from '#shared/config/ranking'
import { maleCrusaderRoleSchema, RANKING_JOBS } from '#entities/character'
import {
  evolutionsQueryText,
  SCORE_SORTS,
  type FameRankingFilter,
  type FameRankingSetFilter,
  type SetStatsFilter,
  type SkillEvolutionChoice,
  type SkillEvolutionType
} from '#entities/ranking'
import { growFilter } from '#widgets/ranking-filter/lib/ranking-jobs'

const text = z.string().min(1).optional().catch(undefined)

// 주소에는 itemIds와 evolutions를 API query와 같은 문자열로 둔다.
export type RankingSearch = Omit<FameRankingFilter, 'itemIds' | 'evolutions'> & {
  itemIds?: string
  evolutions?: string
}

const EVOLUTION_PATTERN = /^([^,~]+)~([12])$/

function evolutionOf(pair: string): SkillEvolutionChoice | null {
  const match = EVOLUTION_PATTERN.exec(pair)

  if (match === null) {
    return null
  }

  const [, name = '', typeText] = match
  const type: SkillEvolutionType = typeText === '1' ? 1 : 2

  return { name, type }
}

// 형식이 틀린 쌍, 같은 스킬 중복, 여섯 쌍 이상이 하나라도 있으면 개화 필터를 모두 버린다.
const evolutionsSchema = z
  .string()
  .transform((value, context) => {
    const pairs = value.split(',')
    const choices = pairs
      .map(evolutionOf)
      .filter((choice): choice is SkillEvolutionChoice => choice !== null)
    const names = new Set(choices.map(({ name }) => name))
    const valid =
      pairs.length <= EVOLUTION_FILTER_LIMIT &&
      choices.length === pairs.length &&
      names.size === choices.length

    if (!valid) {
      context.addIssue({ code: 'custom', message: 'invalid evolutions' })

      return z.NEVER
    }

    return choices
  })
  .optional()
  .catch(undefined)

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

// 빈 값이 0이 되지 않게 coerce하지 않는다. router가 주소의 숫자를 number로 읽어 준다.
// API가 INTEGER 열과 비교하는 9자리까지만 받는다.
const rangeBound = z.number().int().min(0).max(999_999_999).optional().catch(undefined)

const searchSchema = z.object({
  jobId: z.string().optional().catch(undefined),
  jobGrowId: z.string().optional().catch(undefined),
  role: maleCrusaderRoleSchema.optional().catch(undefined),
  equipmentSetId: text,
  oathSetId: z.coerce.number().int().positive().optional().catch(undefined),
  oathSetOption: text,
  itemIds: itemIdsSchema,
  evolutions: evolutionsSchema,
  sort: z.enum(SCORE_SORTS).optional().catch(undefined),
  fameFrom: rangeBound,
  fameTo: rangeBound,
  scoreFrom: rangeBound,
  scoreTo: rangeBound
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

type RangeFilter = Pick<FameRankingFilter, 'sort' | 'fameFrom' | 'fameTo' | 'scoreFrom' | 'scoreTo'>

function isReversed(from: number | undefined, to: number | undefined): boolean {
  return from !== undefined && to !== undefined && from > to
}

// API는 기준과 맞지 않는 범위와 거꾸로 된 범위를 거절하므로, 기준이 아닌 쪽 범위와 거꾸로 된 범위는 버린다.
function rangeFilterOf({
  sort,
  fameFrom,
  fameTo,
  scoreFrom,
  scoreTo
}: z.infer<typeof searchSchema>): RangeFilter {
  if (sort === undefined) {
    if (isReversed(fameFrom, fameTo)) {
      return {}
    }

    return {
      ...(fameFrom !== undefined && { fameFrom }),
      ...(fameTo !== undefined && { fameTo })
    }
  }

  if (isReversed(scoreFrom, scoreTo)) {
    return { sort }
  }

  return {
    sort,
    ...(scoreFrom !== undefined && { scoreFrom }),
    ...(scoreTo !== undefined && { scoreTo })
  }
}

function itemFilterOf({ itemIds }: z.infer<typeof searchSchema>): RankingSearch {
  if (itemIds === undefined) {
    return {}
  }

  return { itemIds: itemIds.join(',') }
}

// API는 전직 없는 개화 필터를 거부하므로 전직을 고르지 않은 주소의 개화는 버린다.
function evolutionFilterOf(
  { evolutions }: z.infer<typeof searchSchema>,
  jobFilter: SetStatsFilter
): RankingSearch {
  if (evolutions === undefined || jobFilter.jobGrowId === undefined) {
    return {}
  }

  const text = evolutionsQueryText(evolutions)

  return { evolutions: text }
}

export function parseRankingSearch(search: Record<string, unknown>): RankingSearch {
  const parsed = searchSchema.parse(search)
  const items = itemFilterOf(parsed)
  const jobFilter = jobFilterOf(parsed)
  const setFilter = setFilterOf(parsed)
  const rangeFilter = rangeFilterOf(parsed)
  const evolutionFilter = evolutionFilterOf(parsed, jobFilter)

  return { ...jobFilter, ...setFilter, ...items, ...evolutionFilter, ...rangeFilter }
}

export function rankingFilterOf({
  itemIds,
  evolutions,
  ...rest
}: RankingSearch): FameRankingFilter {
  const itemIdList = itemIds?.split(',')
  const items = itemIdList !== undefined ? { itemIds: itemIdList } : {}
  const parsedEvolutions = evolutionsSchema.parse(evolutions)
  const evolutionFilter = parsedEvolutions !== undefined ? { evolutions: parsedEvolutions } : {}

  return { ...rest, ...items, ...evolutionFilter }
}

export function rankingSearchOf({
  itemIds,
  evolutions,
  ...rest
}: FameRankingFilter): RankingSearch {
  const itemIdsText = itemIds !== undefined && itemIds.length > 0 ? itemIds.join(',') : undefined
  const items = itemIdsText !== undefined ? { itemIds: itemIdsText } : {}
  const evolutionText =
    evolutions !== undefined && evolutions.length > 0 ? evolutionsQueryText(evolutions) : undefined
  const evolutionSearch = evolutionText !== undefined ? { evolutions: evolutionText } : {}

  return { ...rest, ...items, ...evolutionSearch }
}

const setSampleSchema = z.enum(SET_SAMPLES).optional().catch(undefined)

// 전체가 기본 표본이라 주소에는 그 밖의 표본만 둔다.
export function parseSetStatsSearch(search: Record<string, unknown>): SetStatsFilter {
  const sample = setSampleSchema.parse(search.sample)
  const jobFilter = jobFilterOf(searchSchema.parse(search))

  return {
    ...jobFilter,
    ...(sample !== undefined && sample !== 'all' && { sample })
  }
}
