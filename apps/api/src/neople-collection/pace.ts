import { setTimeout } from 'node:timers/promises'
import type { NeopleFailureKind } from '@dfragon/neople'
import { z } from 'zod'

const DEFAULT_REQUESTS_PER_SECOND = 5
const DEFAULT_CONCURRENCY = 1
const MAX_CONCURRENCY = 32

export const requestsPerSecondSchema = z.coerce
  .number()
  .positive()
  .finite()
  .default(DEFAULT_REQUESTS_PER_SECOND)

export const concurrencySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_CONCURRENCY)
  .default(DEFAULT_CONCURRENCY)

export type CollectionResult = 'recorded' | 'failed' | 'unavailable'

export interface CollectionPace {
  requestIntervalMs: number
  concurrency: number
}

// 한도 초과(429), 점검(503), timeout은 캐릭터 문제가 아니라 기록하지 않고 나중에 같은 캐릭터를 다시 부른다.
export function isNeopleUnavailable(kind: NeopleFailureKind): kind is 'unavailable' | 'timeout' {
  return kind === 'unavailable' || kind === 'timeout'
}

export async function collectPaced<T>(
  items: readonly T[],
  collect: (item: T) => Promise<CollectionResult>,
  { requestIntervalMs, concurrency }: CollectionPace
): Promise<'collected' | 'unavailable'> {
  for (let start = 0; start < items.length; start += concurrency) {
    const group = items.slice(start, start + concurrency)
    const startedAt = performance.now()
    const results = await Promise.all(group.map((item) => collect(item)))
    if (results.includes('unavailable')) {
      return 'unavailable'
    }
    // 묶음마다 요청 수만큼의 간격을 채워 평균 속도가 초당 상한을 넘지 않게 한다.
    const remainingMs = group.length * requestIntervalMs - (performance.now() - startedAt)
    await setTimeout(Math.max(0, remainingMs))
  }

  return 'collected'
}
