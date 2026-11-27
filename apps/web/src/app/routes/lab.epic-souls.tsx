import { createFileRoute } from '@tanstack/react-router'
import { LabEpicSoulsPage } from '#pages/lab-epic-souls'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/lab/epic-souls')({
  head: () => pageHead({ title: '실험실 숨은 에소찾기', path: '/lab/epic-souls' }),
  component: LabEpicSoulsPage
})
