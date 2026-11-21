import { createFileRoute } from '@tanstack/react-router'
import { TermsPage } from '#pages/legal'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/terms')({
  ssr: true,
  head: () => pageHead({ title: '이용약관', path: '/terms' }),
  component: TermsPage
})
