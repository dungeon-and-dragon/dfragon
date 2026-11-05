import { type QueryKey, useQuery } from '@tanstack/react-query'

export type LoadedResult<Value> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; value: Value }>
  | Readonly<{ status: 'error'; message: string }>

const LOADING = { status: 'loading' } as const

/** `queryKey`별로 받은 값을 캐시하고, 다른 key로 바뀐 뒤 늦게 온 응답은 지금 key의 값을 덮지 않는다. */
export function useLoadedResult<Value>(
  queryKey: QueryKey,
  load: () => Promise<Value>
): LoadedResult<Value> {
  const { data, error } = useQuery({ queryKey, queryFn: load })
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
