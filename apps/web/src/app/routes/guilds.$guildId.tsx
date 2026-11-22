import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { GuildPage, guildQuery } from '#pages/guild'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/guilds/$guildId')({
  ssr: true,
  // 브라우저에서 화면을 옮겨 올 때는 받기를 기다리지 않으므로 이름은 캐시에 있을 때만 돌려준다.
  loader: async ({ context: { queryClient }, params: { guildId } }) => {
    const query = guildQuery(guildId)
    await prefetchOnServer(queryClient, query)
    const guildName = queryClient.getQueryData(query.queryKey)?.guildName ?? null

    return { guildName }
  },
  head: ({ params: { guildId }, loaderData }) => {
    const title = loaderData?.guildName != null ? `${loaderData.guildName} 길드` : '길드'

    return pageHead({ title, path: `/guilds/${encodeURIComponent(guildId)}` })
  },
  component: GuildPage
})
