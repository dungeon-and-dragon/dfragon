import { QueryClient } from '@tanstack/react-query'

const CACHE_TIME_MS = 5 * 60_000

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIME_MS,
        gcTime: CACHE_TIME_MS,
        retry: false,
        refetchOnWindowFocus: false
      }
    }
  })
}
