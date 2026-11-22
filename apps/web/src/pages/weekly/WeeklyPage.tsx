import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useMyAdventureStore } from '#entities/adventure-guild'
import { AdventureEquipmentScreen } from './AdventureEquipmentScreen'
import { AdventureTimelineScreen } from './AdventureTimelineScreen'
import type { EquipmentSearch } from './equipment-search'
import type { TimelineSearch } from './timeline-search'
import { AdventureEntryScreen, WeeklyScreen } from './WeeklyScreen'

const route = getRouteApi('/adventures/$adventureName/')
const equipmentRoute = getRouteApi('/adventures/$adventureName/equipment')
const timelineRoute = getRouteApi('/adventures/$adventureName/timeline')

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

export function AdventureEquipmentPage(): React.JSX.Element {
  const { adventureName } = equipmentRoute.useParams()
  const search = equipmentRoute.useSearch()
  const navigate = equipmentRoute.useNavigate()
  const openAdventure = useOpenAdventure()

  async function changeSearch(next: EquipmentSearch): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return (
    <AdventureEquipmentScreen
      key={adventureName}
      adventureName={adventureName}
      search={search}
      onSearchChange={changeSearch}
      onAdventureOpen={openAdventure}
    />
  )
}

export function AdventureTimelinePage(): React.JSX.Element {
  const { adventureName } = timelineRoute.useParams()
  const search = timelineRoute.useSearch()
  const navigate = timelineRoute.useNavigate()
  const openAdventure = useOpenAdventure()

  async function changeSearch(next: TimelineSearch): Promise<void> {
    await navigate({ search: next, resetScroll: false })
  }

  return (
    <AdventureTimelineScreen
      key={adventureName}
      adventureName={adventureName}
      search={search}
      onSearchChange={changeSearch}
      onAdventureOpen={openAdventure}
    />
  )
}
