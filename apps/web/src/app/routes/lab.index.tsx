import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/lab/')({
  ssr: true,
  beforeLoad: () => {
    throw redirect({ to: '/lab/enchants', replace: true })
  }
})
