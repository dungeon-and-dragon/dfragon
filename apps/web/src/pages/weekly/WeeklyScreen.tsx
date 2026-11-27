import { type ReactNode } from 'react'
import { useOathCatalog } from '#entities/catalog'
import { SkeletonRow } from '#widgets/character-table'
import { ListBox } from '#shared/ui/ListBox'
import { AdventureNameForm, AdventureTabsForm } from './AdventureNameForm'
import { AdventureTabs } from './AdventureTabs'
import { useAdventureWeekly } from './api/useAdventureWeekly'
import { ActivityHeatmap } from './ActivityHeatmap'
import { AdventureDashboard } from './AdventureDashboard'
import { SeasonClears } from './SeasonClears'
import { adventureTabsHeight, WIDE_STICKY_TABLE_FRAME } from './sticky-head'
import { WeeklyClearTable } from './WeeklyClearTable'
import { useObservedHeight } from './use-observed-height'

const LOADING_ROWS = 5

const SCREEN = 'flex flex-col'

export function AdventureEntryScreen({
  onAdventureOpen
}: {
  onAdventureOpen: (adventureName: string) => void
}): React.JSX.Element {
  return (
    <div className={SCREEN}>
      <header className="section screen-head">
        <h1 className="screen-title">모험단</h1>
      </header>
      <div className="section">
        <AdventureNameForm initialName="" onAdventureOpen={onAdventureOpen} />
      </div>
    </div>
  )
}

export function WeeklyScreen({
  adventureName,
  season,
  onSeasonChange,
  onAdventureOpen
}: {
  adventureName: string
  season: number | undefined
  onSeasonChange: (season: number) => void
  onAdventureOpen: (adventureName: string) => void
}): React.JSX.Element {
  const [observeTabs, tabsHeight] = useObservedHeight()

  return (
    <div className={SCREEN} style={adventureTabsHeight(tabsHeight)}>
      <AdventureTabs
        ref={observeTabs}
        adventureName={adventureName}
        actions={
          <AdventureTabsForm adventureName={adventureName} onAdventureOpen={onAdventureOpen} />
        }
      />
      <div className="section">
        <AdventureDashboard
          adventureName={adventureName}
          season={season}
          onSeasonChange={onSeasonChange}
        />
      </div>
      <ActivityHeatmap adventureName={adventureName} season={season} />
      <SeasonClears adventureName={adventureName} season={season} />
      <WeeklyClearList adventureName={adventureName} />
    </div>
  )
}

function WeeklyClearBox({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <section aria-label="이번 주 클리어" className="section min-w-0">
      <div className={WIDE_STICKY_TABLE_FRAME}>{children}</div>
    </section>
  )
}

function WeeklyClearList({ adventureName }: { adventureName: string }): React.JSX.Element {
  const result = useAdventureWeekly(adventureName)
  const catalogResult = useOathCatalog()
  const catalog = catalogResult.status === 'success' ? catalogResult.value : null

  switch (result.status) {
    case 'loading':
      return (
        <WeeklyClearBox>
          <div aria-busy="true">
            <WeeklyClearTable
              clearNames={[]}
              rows={[]}
              catalog={catalog}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow
                  key={index}
                  rankOnNarrow={false}
                  detail
                  scorePlacement="column"
                  affiliations={[]}
                />
              ))}
            />
          </div>
        </WeeklyClearBox>
      )
    case 'error':
      return (
        <WeeklyClearBox>
          <p role="alert" className="state state-error">
            {result.message}
          </p>
        </WeeklyClearBox>
      )
    case 'success':
      if (result.value.characters.length === 0) {
        return <ListBox name={adventureName} />
      }

      return (
        <WeeklyClearBox>
          <WeeklyClearTable
            clearNames={result.value.clearNames}
            rows={result.value.characters}
            catalog={catalog}
          />
        </WeeklyClearBox>
      )
  }
}
