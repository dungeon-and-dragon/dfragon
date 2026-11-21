import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPage } from '#pages/legal'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/privacy')({
  ssr: true,
  head: () => pageHead({ title: '개인정보처리방침', path: '/privacy' }),
  component: PrivacyPage
})
