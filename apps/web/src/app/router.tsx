import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createQueryClient } from '#app/query-client'
import { routeTree } from '#app/routeTree.gen'

// 서버에서는 요청마다 router를 만들므로, 조회 캐시가 요청 사이에 섞이지 않게 QueryClient도 여기서 만든다.
export function getRouter() {
  const queryClient = createQueryClient()
  const router = createRouter({ routeTree })
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
