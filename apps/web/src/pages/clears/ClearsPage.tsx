import { getRouteApi } from '@tanstack/react-router'
import type { ClearSearch } from './clear-search'
import { ClearsScreen } from './ClearsScreen'

const route = getRouteApi('/clears')

export function ClearsPage(): React.JSX.Element {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  async function changeSearch(next: ClearSearch): Promise<void> {
    await navigate({ search: next })
  }

  return <ClearsScreen search={search} onSearchChange={changeSearch} />
}
