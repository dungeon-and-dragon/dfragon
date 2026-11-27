import { createFileRoute } from '@tanstack/react-router'
import { MultisearchPage } from '#pages/multisearch'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/lab/multisearch')({
  head: () => pageHead({ title: '실험실 멀티서치', path: '/lab/multisearch' }),
  component: MultisearchPage
})
