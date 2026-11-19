import { getRouteApi } from '@tanstack/react-router'
import type { FameRankingFilter } from '#entities/ranking'
import { RankingsScreen } from './RankingsScreen'
import { rankingFilterOf, rankingSearchOf } from '#widgets/ranking-filter'

const route = getRouteApi('/rankings')

export function RankingsPage(): React.JSX.Element {
  const filter = rankingFilterOf(route.useSearch())
  const navigate = route.useNavigate()

  async function changeFilter(next: FameRankingFilter): Promise<void> {
    await navigate({ search: rankingSearchOf(next), resetScroll: false })
  }

  return <RankingsScreen filter={filter} onFilterChange={changeFilter} />
}
