import { type QueryKey, useQuery } from '@tanstack/react-query'

export type LoadedResult<Value> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; value: Value }>
  | Readonly<{ status: 'error'; message: string }>

type LoadedResultOptions = Readonly<{
  keepPreviousWhile?: (previousKey: QueryKey) => boolean
  // false인 동안은 받지 않고 받는 중으로 둔다.
  enabled?: boolean
}>

const LOADING = { status: 'loading' } as const

/**
 * `queryKey`별로 받은 값을 캐시하고, 다른 key로 바뀐 뒤 늦게 온 응답은 지금 key의 값을 덮지 않는다.
 * `keepPreviousWhile`이 앞 key에 true를 주면 새 key를 받는 동안 앞 key의 값을 보인다.
 */
export function useLoadedResult<Value>(
  queryKey: QueryKey,
  load: () => Promise<Value>,
  { keepPreviousWhile, enabled = true }: LoadedResultOptions = {}
): LoadedResult<Value> {
  const { data, error } = useQuery({
    queryKey,
    queryFn: load,
    enabled,
    placeholderData: (previous, previousQuery) => {
      if (previousQuery === undefined || keepPreviousWhile?.(previousQuery.queryKey) !== true) {
        return undefined
      }

      return previous
    }
  })

  // 캐시가 만료된 뒤 다시 받다가 실패해도 받아 둔 값을 계속 보인다.
  if (data !== undefined) {
    return { status: 'success', value: data }
  }

  if (error != null) {
    const message = error instanceof Error ? error.message : String(error)

    return { status: 'error', message }
  }

  return LOADING
}
