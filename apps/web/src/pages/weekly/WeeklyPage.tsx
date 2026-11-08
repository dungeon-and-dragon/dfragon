import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useMyAdventureStore } from '../../hooks/useMyAdventureStore'
import { AdventureEntryScreen, WeeklyScreen } from './WeeklyScreen'

const route = getRouteApi('/adventures/$adventureName')

function useOpenAdventure(): (adventureName: string) => Promise<void> {
  const navigate = useNavigate()
  const changeAdventureName = useMyAdventureStore((state) => state.changeAdventureName)

  return async (adventureName) => {
    changeAdventureName(adventureName)
    await navigate({ to: '/adventures/$adventureName', params: { adventureName } })
  }
}

export function WeeklyPage(): React.JSX.Element {
  const { adventureName } = route.useParams()
  const { season } = route.useSearch()
  const navigate = route.useNavigate()
  const openAdventure = useOpenAdventure()

  async function changeSeason(next: number): Promise<void> {
    await navigate({ search: { season: next }, resetScroll: false })
  }

  return (
    <WeeklyScreen
      key={adventureName}
      adventureName={adventureName}
      season={season}
      onSeasonChange={changeSeason}
      onAdventureOpen={openAdventure}
    />
  )
}

export function AdventureEntryPage(): React.JSX.Element {
  const openAdventure = useOpenAdventure()

  return <AdventureEntryScreen onAdventureOpen={openAdventure} />
}
