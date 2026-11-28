import type { FameRankingFilter, ScoreSort } from '#entities/ranking'

// API가 INTEGER 열과 비교하므로 0으로 시작하지 않는 9자리까지의 정수만 받는다.
export const MAX_RANGE_DIGITS = 9
const RANGE_PATTERN = new RegExp(`^(0|[1-9]\\d{0,${MAX_RANGE_DIGITS - 1}})$`)

export type SearchRange = Readonly<{ from?: number; to?: number }>

function boundOf(text: string): number | undefined | null {
  const trimmed = text.trim()

  if (trimmed === '') {
    return undefined
  }

  if (!RANGE_PATTERN.test(trimmed)) {
    return null
  }

  return Number(trimmed)
}

export function searchRangeOf(fromText: string, toText: string): SearchRange | null {
  const from = boundOf(fromText)
  const to = boundOf(toText)

  if (from === null || to === null) {
    return null
  }

  if (from !== undefined && to !== undefined && from > to) {
    return null
  }

  return {
    ...(from !== undefined && { from }),
    ...(to !== undefined && { to })
  }
}

export function rangeOfFilter({
  sort,
  fameFrom,
  fameTo,
  scoreFrom,
  scoreTo
}: FameRankingFilter): SearchRange {
  if (sort === undefined) {
    return { from: fameFrom, to: fameTo }
  }

  return { from: scoreFrom, to: scoreTo }
}

type CriterionFilter = Pick<
  FameRankingFilter,
  'sort' | 'fameFrom' | 'fameTo' | 'scoreFrom' | 'scoreTo'
>

// 다른 기준의 범위와 sort를 undefined 키로 두어, 필터에 펼쳐 넣을 때 앞서 넣은 값을 덮어 지운다.
export function criterionFilterOf(
  sort: ScoreSort | undefined,
  { from, to }: SearchRange
): CriterionFilter {
  if (sort === undefined) {
    return { sort, fameFrom: from, fameTo: to, scoreFrom: undefined, scoreTo: undefined }
  }

  return { sort, fameFrom: undefined, fameTo: undefined, scoreFrom: from, scoreTo: to }
}
