import { getRouteApi } from '@tanstack/react-router'
import { SimulatorSearchScreen } from './SimulatorSearchScreen'

const route = getRouteApi('/simulator')

export function SimulatorSearchPage(): React.JSX.Element {
  const query = route.useSearch()

  return <SimulatorSearchScreen query={query} />
}
