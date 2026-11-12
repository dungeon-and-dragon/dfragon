import type { Context } from 'hono'
import { mapValues } from 'remeda'

/** 같은 key가 여러 번 오면 값을 배열로 두어, 문자열 하나만 받는 검증이 중복 key를 거절하게 한다. */
export function readQuery(c: Context): Record<string, string | string[]> {
  return mapValues(c.req.queries(), (values) => {
    if (values.length === 1) {
      return values[0]!
    }

    return values
  })
}
