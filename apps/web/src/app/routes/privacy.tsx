import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPage } from '#pages/legal'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage
})
