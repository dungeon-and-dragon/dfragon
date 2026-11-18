// Neople 명성 검색은 한 번에 명성 2,000 범위와 200행까지만 답하고 다음 페이지 cursor가 없다.
// 구간의 양 끝 명성을 포함하고 명성이 높은 순으로 답한다(2026-11-18 실제 응답).
export const FAME_SEARCH_RANGE = 2000
export const FAME_SEARCH_LIMIT = 200

export type FameWindow = {
  minFame: number
  maxFame: number
}

export function fameWindowBelow(maxFame: number): FameWindow {
  const minFame = Math.max(0, maxFame - FAME_SEARCH_RANGE)

  return { minFame, maxFame }
}

/** 돌려주는 값이 `window.maxFame`보다 작지 않으면 호출한 쪽이 같은 구간을 끝없이 다시 부른다. 끝나면 undefined다. */
export function nextMaxFame(window: FameWindow, fames: readonly number[]): number | undefined {
  if (fames.length < FAME_SEARCH_LIMIT) {
    if (window.minFame > 0) {
      return window.minFame - 1
    }

    return undefined
  }

  // 가장 낮은 명성에는 받지 못한 캐릭터가 남았을 수 있어 그 명성부터 다시 받는다.
  const lowestFame = Math.min(...fames)

  if (lowestFame < window.maxFame) {
    return lowestFame
  }

  // 한 명성에 FAME_SEARCH_LIMIT명이 넘게 몰리면 남은 캐릭터를 받을 방법이 없어 그 명성을 건너뛴다.
  if (window.maxFame > 0) {
    return window.maxFame - 1
  }

  return undefined
}
