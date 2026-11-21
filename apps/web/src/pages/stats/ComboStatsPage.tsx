import { getRouteApi } from '@tanstack/react-router'
import type { SetStatsFilter } from '#entities/ranking'
import { ComboStatsScreen } from './ComboStatsScreen'

const route = getRouteApi('/stats/combos')

export function ComboStatsPage(): React.JSX.Element {
  const filter = route.useSearch()
  const navigate = route.useNavigate()

  async function changeFilter(next: SetStatsFilter): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return <ComboStatsScreen filter={filter} onFilterChange={changeFilter} />
}
