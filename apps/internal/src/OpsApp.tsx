import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OpsClient } from './api/ops-client'
import { OpsClientContext } from './ops-queries'
import { OpsScreen } from './OpsScreen'

export function OpsApp({
  client,
  queryClient
}: {
  client: OpsClient
  queryClient: QueryClient
}): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <OpsClientContext value={client}>
        <OpsScreen />
      </OpsClientContext>
    </QueryClientProvider>
  )
}
