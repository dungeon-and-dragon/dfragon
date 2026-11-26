import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { LabEnchantsPage, labItemsQuery } from '#pages/lab'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/lab/enchants')({
  ssr: true,
  head: () => pageHead({ title: '실험실 마법부여', path: '/lab/enchants' }),
  loader: ({ context: { queryClient } }) => prefetchOnServer(queryClient, labItemsQuery),
  component: LabEnchantsPage
})
