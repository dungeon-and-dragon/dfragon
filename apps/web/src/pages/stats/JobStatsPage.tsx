import { getRouteApi } from '@tanstack/react-router'
import type { SetStatsFilter } from '#entities/ranking'
import { JobStatsScreen } from './JobStatsScreen'

const route = getRouteApi('/stats/jobs')

export function JobStatsPage(): React.JSX.Element {
  const filter = route.useSearch()
  const navigate = route.useNavigate()

  async function changeFilter(next: SetStatsFilter): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return <JobStatsScreen filter={filter} onFilterChange={changeFilter} />
}
