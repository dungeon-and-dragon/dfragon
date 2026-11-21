import { createFileRoute } from '@tanstack/react-router'
import { GuildPage } from '#pages/guild'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/guilds/$guildId')({
  head: ({ params: { guildId } }) =>
    pageHead({ title: '길드', path: `/guilds/${encodeURIComponent(guildId)}` }),
  component: GuildPage
})
