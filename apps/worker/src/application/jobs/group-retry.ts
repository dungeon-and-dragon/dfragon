const UNAVAILABLE_SKIP_ATTEMPTS = 3

export const UNAVAILABLE_PAUSE_MS = 60_000

export type UnavailableAttempt<Result> = {
  attempted: number
  unavailable: readonly Result[]
  paused: boolean
}

export type GroupRetry<Result> = {
  isUnavailable: (result: Result) => boolean
  pause: (ms: number) => Promise<void>
  onUnavailable: (attempt: UnavailableAttempt<Result>) => void
}

/**
 * 묶음 전체가 unavailable이면 Neople 점검, 장애로 보고 쉬었다가 묶음을 다시 받으며 횟수를 세지 않는다.
 * 일부만 unavailable이면 쉬지 않고 그 대상만 다시 받고, 세 번 연속 unavailable인 대상은 unavailable 결과로 돌려준다.
 */
export async function fetchGroupWithRetry<Target, Result>(
  group: readonly Target[],
  fetchGroup: (targets: readonly Target[]) => Promise<readonly Result[]>,
  { isUnavailable, pause, onUnavailable }: GroupRetry<Result>
): Promise<Result[]> {
  const results = new Map<number, Result>()
  const attempts = new Map<number, number>()
  let pending = group.map((_, index) => index)

  while (pending.length > 0) {
    const fetched = await fetchGroup(pending.map((index) => group[index]!))

    for (const [position, index] of pending.entries()) {
      results.set(index, fetched[position]!)
    }

    const unavailable = pending.filter((index) => isUnavailable(results.get(index)!))

    if (unavailable.length === 0) {
      break
    }

    const unavailableResults = unavailable.map((index) => results.get(index)!)
    const attempt = { attempted: pending.length, unavailable: unavailableResults }

    if (unavailable.length === group.length) {
      onUnavailable({ ...attempt, paused: true })
      await pause(UNAVAILABLE_PAUSE_MS)
      continue
    }

    onUnavailable({ ...attempt, paused: false })

    for (const index of unavailable) {
      attempts.set(index, (attempts.get(index) ?? 0) + 1)
    }

    pending = unavailable.filter((index) => attempts.get(index)! < UNAVAILABLE_SKIP_ATTEMPTS)
  }

  return group.map((_, index) => results.get(index)!)
}
