import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OpsClient } from '#ops-api/ops-client'
import { OpsClientContext } from './ops-queries'
import { OpsScreen } from './OpsScreen'
import type { OpsPageId } from './pages'

export function OpsApp({
  client,
  queryClient,
  page
}: {
  client: OpsClient
  queryClient: QueryClient
  page: OpsPageId
}): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <OpsClientContext value={client}>
        <OpsScreen page={page} />
      </OpsClientContext>
    </QueryClientProvider>
  )
}
