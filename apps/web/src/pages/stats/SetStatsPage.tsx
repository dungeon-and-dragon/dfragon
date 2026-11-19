import { getRouteApi } from '@tanstack/react-router'
import type { SetStatsFilter } from '#entities/ranking'
import { SetStatsScreen } from './SetStatsScreen'

const route = getRouteApi('/stats/sets')

export function SetStatsPage(): React.JSX.Element {
  const filter = route.useSearch()
  const navigate = route.useNavigate()

  async function changeFilter(next: SetStatsFilter): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return <SetStatsScreen filter={filter} onFilterChange={changeFilter} />
}
