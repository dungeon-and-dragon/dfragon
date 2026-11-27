import { getRouteApi } from '@tanstack/react-router'
import { CharacterSimulatorScreen } from './CharacterSimulatorScreen'

const route = getRouteApi('/c/$serverId/$characterId_/simulator')

export function CharacterSimulatorPage(): React.JSX.Element {
  const { serverId, characterId } = route.useParams()
  const savedChanges = route.useSearch({ select: (search) => search.changes })
  const navigate = route.useNavigate()

  // 값을 바꿀 때마다 기록을 쌓으면 뒤로 가기가 이전 화면 대신 직전 값으로 가므로 지금 기록을 바꾼다.
  async function saveChanges(changes: string | undefined): Promise<void> {
    await navigate({ search: { changes }, replace: true, resetScroll: false })
  }

  return (
    <CharacterSimulatorScreen
      serverId={serverId}
      characterId={characterId}
      savedChanges={savedChanges}
      onChangesSave={saveChanges}
    />
  )
}
