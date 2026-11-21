import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { HomePage, soulPricesQuery } from '#pages/home'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/')({
  ssr: true,
  head: () => pageHead({ title: null, path: '/' }),
  loader: ({ context: { queryClient } }) => prefetchOnServer(queryClient, soulPricesQuery),
  component: HomePage
})
