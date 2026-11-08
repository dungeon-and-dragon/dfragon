import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router'
import { createContext, type ReactNode, useContext, useState } from 'react'

const RouteContent = createContext<ReactNode>(null)

function RenderedContent(): ReactNode {
  return useContext(RouteContent)
}

// 화면이 다시 그려져도 같은 라우터를 쓰도록, 그릴 내용은 라우터 밖의 context로 넘긴다.
export function TestRouter({ children }: { children: ReactNode }): React.JSX.Element {
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute({ component: RenderedContent }),
      history: createMemoryHistory({ initialEntries: ['/'] })
    })
  )

  return (
    <RouteContent value={children}>
      <RouterProvider router={router} />
    </RouteContent>
  )
}
