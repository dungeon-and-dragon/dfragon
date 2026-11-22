import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { HomePage, soulPricesQuery } from '#pages/home'
import { PRODUCT_NAME } from '@dfragon/lib'
import { pageHead, siteUrl } from '#shared/lib/page-head'

export const Route = createFileRoute('/')({
  ssr: true,
  head: () => {
    const url = siteUrl('/')
    const structuredData = { '@type': 'WebSite', name: PRODUCT_NAME, url }

    return pageHead({ title: null, path: '/', structuredData })
  },
  loader: ({ context: { queryClient } }) => prefetchOnServer(queryClient, soulPricesQuery),
  component: HomePage
})
