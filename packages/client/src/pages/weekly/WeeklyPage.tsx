import { getRouteApi } from '@tanstack/react-router'
import { WeeklyScreen } from './WeeklyScreen'

const route = getRouteApi('/my')

export function WeeklyPage(): React.JSX.Element {
  const { season } = route.useSearch()
  const navigate = route.useNavigate()

  async function changeSeason(next: number): Promise<void> {
    await navigate({ search: { season: next }, resetScroll: false })
  }

  return <WeeklyScreen season={season} onSeasonChange={changeSeason} />
}
