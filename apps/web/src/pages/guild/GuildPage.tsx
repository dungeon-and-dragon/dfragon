import { getRouteApi } from '@tanstack/react-router'
import { GuildScreen } from './GuildScreen'

const route = getRouteApi('/guilds/$guildId')

export function GuildPage(): React.JSX.Element {
  const { guildId } = route.useParams()

  return <GuildScreen guildId={guildId} />
}
