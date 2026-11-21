import { getRouteApi } from '@tanstack/react-router'
import type { SetStatsFilter } from '#entities/ranking'
import { WeaponStatsScreen } from './WeaponStatsScreen'

const route = getRouteApi('/stats/weapons')

export function WeaponStatsPage(): React.JSX.Element {
  const filter = route.useSearch()
  const navigate = route.useNavigate()

  async function changeFilter(next: SetStatsFilter): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return <WeaponStatsScreen filter={filter} onFilterChange={changeFilter} />
}
