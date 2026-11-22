import { createFileRoute } from '@tanstack/react-router'
import { fameRankingQuery } from '#entities/ranking'
import { RankingsPage } from '#pages/rankings'
import { parseRankingSearch, rankingFilterOf } from '#widgets/ranking-filter'
import { pageHead, siteUrl } from '#shared/lib/page-head'

// 구조화 데이터에는 화면이 첫 쪽에 보이는 만큼만 넣는다.
const LISTED_CHARACTERS = 20

export const Route = createFileRoute('/rankings')({
  ssr: true,
  validateSearch: parseRankingSearch,
  loaderDeps: ({ search }) => search,
  // 브라우저에서는 화면의 hook이 받으면서 받는 중 모양을 먼저 보이므로, 서버에서만 첫 쪽을 미리 받는다.
  // 구조화 데이터에 넣을 첫 쪽의 캐릭터는 캐시에 있을 때만 돌려준다.
  loader: async ({ context: { queryClient }, deps }) => {
    const query = fameRankingQuery(rankingFilterOf(deps))

    if (typeof window === 'undefined') {
      await queryClient.prefetchInfiniteQuery(query)
    }

    const firstPage = queryClient.getQueryData(query.queryKey)?.pages[0]
    const listed = (firstPage?.characters ?? []).slice(0, LISTED_CHARACTERS)
    const characters = listed.map(({ serverId, characterId, characterName }) => ({
      serverId,
      characterId,
      characterName
    }))

    return { characters }
  },
  head: ({ loaderData }) => {
    const characters = loaderData?.characters ?? []
    const itemListElement = characters.map(({ serverId, characterId, characterName }, index) => {
      const position = index + 1
      const url = siteUrl(`/c/${encodeURIComponent(serverId)}/${encodeURIComponent(characterId)}`)

      return { '@type': 'ListItem', position, name: characterName, url }
    })
    const structuredData = characters.length > 0 ? { '@type': 'ItemList', itemListElement } : null

    return pageHead({ title: '검색', path: '/rankings', structuredData })
  },
  component: RankingsPage
})
