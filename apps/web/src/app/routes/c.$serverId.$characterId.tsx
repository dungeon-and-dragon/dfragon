import { createFileRoute, notFound } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import {
  CharacterDetailPage,
  characterDetailQuery,
  isCharacterNotFound,
  parseCharacterTabSearch
} from '#pages/character'
import { pageHead, siteUrl } from '#shared/lib/page-head'

export const Route = createFileRoute('/c/$serverId/$characterId')({
  ssr: true,
  validateSearch: parseCharacterTabSearch,
  // 브라우저에서 화면을 옮겨 올 때는 받기를 기다리지 않으므로 이름은 캐시에 있을 때만 돌려준다.
  loader: async ({ context: { queryClient }, params }) => {
    const query = characterDetailQuery(params)
    await prefetchOnServer(queryClient, query)
    const state = queryClient.getQueryState(query.queryKey)

    if (typeof window === 'undefined' && isCharacterNotFound(state?.error)) {
      throw notFound()
    }

    const characterName = state?.data?.character.characterName ?? null

    return { characterName }
  },
  head: ({ params: { serverId, characterId }, loaderData }) => {
    const characterName = loaderData?.characterName ?? null
    const path = `/c/${encodeURIComponent(serverId)}/${encodeURIComponent(characterId)}`
    const url = siteUrl(path)
    const structuredData =
      characterName !== null
        ? { '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: characterName, url } }
        : null
    const title = characterName ?? '캐릭터'

    return pageHead({ title, path, structuredData })
  },
  component: CharacterDetailPage
})
