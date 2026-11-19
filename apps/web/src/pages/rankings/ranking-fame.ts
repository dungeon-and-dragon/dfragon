import type { FameRankingFameRange } from '#entities/ranking'

// API가 INTEGER 열과 비교하므로 0으로 시작하지 않는 9자리까지의 정수만 받는다.
const FAME_PATTERN = /^(0|[1-9]\d{0,8})$/

function fameOf(text: string): number | undefined | null {
  const trimmed = text.trim()

  if (trimmed === '') {
    return undefined
  }

  if (!FAME_PATTERN.test(trimmed)) {
    return null
  }

  return Number(trimmed)
}

export function fameRangeOf(fromText: string, toText: string): FameRankingFameRange | null {
  const fameFrom = fameOf(fromText)
  const fameTo = fameOf(toText)

  if (fameFrom === null || fameTo === null) {
    return null
  }

  if (fameFrom !== undefined && fameTo !== undefined && fameFrom > fameTo) {
    return null
  }

  return {
    ...(fameFrom !== undefined && { fameFrom }),
    ...(fameTo !== undefined && { fameTo })
  }
}
