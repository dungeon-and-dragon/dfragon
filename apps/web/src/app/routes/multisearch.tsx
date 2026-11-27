import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/multisearch')({
  ssr: true,
  beforeLoad: () => {
    throw redirect({ to: '/lab/multisearch', replace: true })
  }
})
