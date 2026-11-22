import { getRouteApi } from '@tanstack/react-router'
import { CharacterSimulatorScreen } from './CharacterSimulatorScreen'

const route = getRouteApi('/c/$serverId/$characterId_/simulator')

export function CharacterSimulatorPage(): React.JSX.Element {
  const { serverId, characterId } = route.useParams()

  return <CharacterSimulatorScreen serverId={serverId} characterId={characterId} />
}
