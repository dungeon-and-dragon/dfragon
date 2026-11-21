import type { FetchQueryOptions, QueryClient, QueryKey } from '@tanstack/react-query'

// 브라우저에서는 화면의 hook이 받으면서 받는 중 모양을 먼저 보이므로 화면 전환을 붙잡지 않는다.
// 서버에서만 화면을 그리기 전에 받아 둔다. 받지 못해도 화면은 그리고, 그때는 브라우저가 다시 받는다.
export function prefetchOnServer<Value, Key extends QueryKey>(
  queryClient: QueryClient,
  query: FetchQueryOptions<Value, Error, Value, Key>
): Promise<void> | undefined {
  if (typeof window !== 'undefined') {
    return undefined
  }

  return queryClient.prefetchQuery(query)
}
