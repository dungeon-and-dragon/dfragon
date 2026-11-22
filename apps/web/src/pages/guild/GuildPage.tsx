import { getRouteApi } from '@tanstack/react-router'
import { useRouteReload } from '#shared/lib/useRouteReload'
import { useGuild } from './api/useGuild'
import { GuildScreen } from './GuildScreen'

const route = getRouteApi('/guilds/$guildId')

export function GuildPage(): React.JSX.Element {
  const { guildId } = route.useParams()
  const titledName = route.useLoaderData({ select: (loaded) => loaded.guildName })
  const result = useGuild(guildId)
  const loadedName = result.status === 'success' ? result.value.guildName : null
  // 브라우저에서 옮겨 온 화면은 제목에 이름이 없으므로, 받은 뒤 loader를 다시 돌려 제목에 넣는다.
  useRouteReload(route.id, loadedName !== null && loadedName !== titledName)

  return <GuildScreen guildId={guildId} />
}
