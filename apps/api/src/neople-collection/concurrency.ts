import type { NeopleFailureKind } from '@dfragon/neople'
import { z } from 'zod'

const DEFAULT_CONCURRENCY = 1
const MAX_CONCURRENCY = 32

export const concurrencySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_CONCURRENCY)
  .default(DEFAULT_CONCURRENCY)

export type CollectionResult = 'recorded' | 'failed' | 'unavailable'

// 한도 초과(429), 점검(503), timeout은 캐릭터 문제가 아니라 기록하지 않고 나중에 같은 캐릭터를 다시 부른다.
export function isNeopleUnavailable(kind: NeopleFailureKind): kind is 'unavailable' | 'timeout' {
  return kind === 'unavailable' || kind === 'timeout'
}

export async function collectGroup<T>(
  group: readonly T[],
  collect: (item: T) => Promise<CollectionResult>
): Promise<'collected' | 'unavailable'> {
  const results = await Promise.all(group.map((item) => collect(item)))

  if (results.includes('unavailable')) {
    return 'unavailable'
  }

  return 'collected'
}
