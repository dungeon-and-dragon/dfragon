import { getRouteApi } from '@tanstack/react-router'
import { CharacterSearchScreen } from './CharacterSearchScreen'

const route = getRouteApi('/search')

export function CharacterSearchPage(): React.JSX.Element {
  const query = route.useSearch()

  return <CharacterSearchScreen query={query} />
}
