import { getRouteApi } from '@tanstack/react-router'
import { useRouteReload } from '#shared/lib/useRouteReload'
import { useCharacterDetail } from './api/useCharacterDetail'
import { type CharacterTab, DEFAULT_CHARACTER_TAB } from './character-tabs'
import { CharacterDetailScreen } from './CharacterDetailScreen'

const route = getRouteApi('/c/$serverId/$characterId')

export function CharacterDetailPage(): React.JSX.Element {
  const { serverId, characterId } = route.useParams()
  const tab = route.useSearch({ select: (search) => search.tab ?? DEFAULT_CHARACTER_TAB })
  const navigate = route.useNavigate()
  const titledName = route.useLoaderData({ select: (loaded) => loaded.characterName })
  const result = useCharacterDetail(serverId, characterId)
  const loadedName = result.status === 'success' ? result.detail.character.characterName : null
  // 브라우저에서 옮겨 온 화면은 제목에 이름이 없으므로, 받은 뒤 loader를 다시 돌려 제목에 넣는다.
  useRouteReload(route.id, loadedName !== null && loadedName !== titledName)

  // 탭을 바꿀 때마다 기록을 쌓으면 뒤로 가기가 표 대신 이전 탭으로 가므로 지금 기록을 바꾼다.
  async function changeTab(next: CharacterTab): Promise<void> {
    await navigate({ search: { tab: next }, replace: true, resetScroll: false })
  }

  return (
    <CharacterDetailScreen
      serverId={serverId}
      characterId={characterId}
      tab={tab}
      onTabChange={changeTab}
    />
  )
}
