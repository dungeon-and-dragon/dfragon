import { getRouteApi } from '@tanstack/react-router'
import type { FameRankingFilter } from '#core/ranking/ranking-stats'
import { RankingsScreen } from './RankingsScreen'

const route = getRouteApi('/rankings')

export function RankingsPage(): React.JSX.Element {
  const filter = route.useSearch()
  const navigate = route.useNavigate()

  async function changeFilter(next: FameRankingFilter): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return <RankingsScreen filter={filter} onFilterChange={changeFilter} />
}
