const UNAVAILABLE_SKIP_ATTEMPTS = 3

export type UnavailableGroupDecision = 'retry' | 'skip'

/**
 * 묶음 전체가 unavailable이면 Neople 점검, 장애로 보고 횟수를 세지 않는다.
 * 같은 시도에서 다른 대상이 성공했는데도 연속으로 unavailable인 대상만 그 대상의 문제로 본다.
 */
export function createUnavailableStreaks<Target extends object>() {
  let streaks = new Map<Target, number>()

  return {
    decide(groupSize: number, unavailable: readonly Target[]): UnavailableGroupDecision {
      if (unavailable.length === groupSize) {
        return 'retry'
      }
      streaks = new Map(unavailable.map((target) => [target, (streaks.get(target) ?? 0) + 1]))

      for (const attempts of streaks.values()) {
        if (attempts < UNAVAILABLE_SKIP_ATTEMPTS) {
          return 'retry'
        }
      }

      return 'skip'
    }
  }
}
