import { getRouteApi } from '@tanstack/react-router'
import type { FameRankingFilter } from '#entities/ranking'
import { SkillStatsScreen } from './SkillStatsScreen'

const route = getRouteApi('/stats/skills')

export function SkillStatsPage(): React.JSX.Element {
  const filter = route.useSearch()
  const navigate = route.useNavigate()

  async function changeFilter(next: FameRankingFilter): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return <SkillStatsScreen filter={filter} onFilterChange={changeFilter} />
}
