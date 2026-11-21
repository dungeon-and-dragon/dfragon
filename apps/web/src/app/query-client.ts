import { QueryClient } from '@tanstack/react-query'

const CACHE_TIME_MS = 5 * 60_000

export function createQueryClient(): QueryClient {
  // 서버는 요청마다 QueryClient를 새로 만들고 버리므로, 조회마다 timer를 남기는 gcTime을 주지 않는다.
  const gcTime = typeof window === 'undefined' ? undefined : CACHE_TIME_MS

  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIME_MS,
        gcTime,
        retry: false,
        refetchOnWindowFocus: false
      }
    }
  })
}
