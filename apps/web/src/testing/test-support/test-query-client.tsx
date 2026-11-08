import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { createQueryClient } from '../../lib/query-client'

// 다시 그려도 같은 캐시를 쓰고, unmount하면 다음 테스트가 빈 캐시로 시작한다.
export function TestQueryClient({ children }: { children: ReactNode }): React.JSX.Element {
  const [queryClient] = useState(createQueryClient)

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
