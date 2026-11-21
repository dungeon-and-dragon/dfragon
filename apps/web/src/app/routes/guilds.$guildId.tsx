import { createFileRoute } from '@tanstack/react-router'
import { GuildPage } from '#pages/guild'

export const Route = createFileRoute('/guilds/$guildId')({
  component: GuildPage
})
