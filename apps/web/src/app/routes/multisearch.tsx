import { createFileRoute } from '@tanstack/react-router'
import { MultisearchPage } from '#pages/multisearch'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/multisearch')({
  head: () => pageHead({ title: '멀티서치', path: '/multisearch' }),
  component: MultisearchPage
})
