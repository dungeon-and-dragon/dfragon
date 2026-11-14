import { getRouteApi } from '@tanstack/react-router'
import { type CharacterTab, DEFAULT_CHARACTER_TAB } from './character-tabs'
import { CharacterDetailScreen } from './CharacterDetailScreen'

const route = getRouteApi('/c/$serverId/$characterId')

export function CharacterDetailPage(): React.JSX.Element {
  const { serverId, characterId } = route.useParams()
  const tab = route.useSearch({ select: (search) => search.tab ?? DEFAULT_CHARACTER_TAB })
  const navigate = route.useNavigate()

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
