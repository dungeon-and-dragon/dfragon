import { createFileRoute } from '@tanstack/react-router'
import { MultisearchPage } from '#pages/multisearch'

export const Route = createFileRoute('/multisearch')({
  component: MultisearchPage
})
