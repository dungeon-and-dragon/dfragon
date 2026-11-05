import { getRouteApi } from '@tanstack/react-router'
import { AdventureScreen } from './AdventureScreen'

const route = getRouteApi('/adventures/$adventureName')

export function AdventurePage(): React.JSX.Element {
  const { adventureName } = route.useParams()

  return <AdventureScreen adventureName={adventureName} />
}
