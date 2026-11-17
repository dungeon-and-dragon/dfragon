import { Button, TextField, TextFieldInput } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, type ReactNode, useState } from 'react'
import { RefreshIcon } from '../../components/RefreshIcon'
import { SkeletonRow } from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { useRefreshAdventureActivity } from './hooks/useAdventureActivity'
import { useAdventureWeekly, useRefreshAdventureWeekly } from './hooks/useAdventureWeekly'
import { ActivityHeatmap } from './ActivityHeatmap'
import { AdventureDashboard } from './AdventureDashboard'
import { WeeklyClearTable } from './WeeklyClearTable'

const LOADING_ROWS = 5

const SCREEN = 'flex flex-col gap-4 p-4'
const DASHBOARD = 'overflow-hidden rounded-panel border border-line bg-canvas'

function AdventureNameForm({
  initialName,
  onAdventureOpen,
  refreshing = false,
  onRefresh
}: {
  initialName: string
  onAdventureOpen: (adventureName: string) => void
  refreshing?: boolean
  onRefresh?: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(initialName)

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    setDraft(event.target.value)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const next = draft.trim()
    if (next !== '') {
      onAdventureOpen(next)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-line px-4 py-3"
    >
      <div className="w-56 max-sm:min-w-0 max-sm:flex-1">
        <TextField size="sm">
          <TextFieldInput
            aria-label="모험단"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={handleDraftChange}
          />
        </TextField>
      </div>
      <Button type="submit" variant="primary" size="sm">
        보기
      </Button>
      {onRefresh != null && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshIcon spinning={refreshing} />
          {refreshing ? '받는 중' : '갱신'}
        </Button>
      )}
    </form>
  )
}

export function AdventureEntryScreen({
  onAdventureOpen
}: {
  onAdventureOpen: (adventureName: string) => void
}): React.JSX.Element {
  return (
    <div className={SCREEN}>
      <div className={DASHBOARD}>
        <h1 className="m-0 p-4 text-xl font-semibold tracking-heading">모험단</h1>
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
  const refreshActivity = useRefreshAdventureActivity()
  const refreshWeekly = useRefreshAdventureWeekly()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh(): Promise<void> {
    setRefreshing(true)
    await Promise.all([refreshActivity(adventureName), refreshWeekly(adventureName)])
    setRefreshing(false)
  }

  return (
    <div className={SCREEN}>
      <div className={DASHBOARD}>
        <AdventureDashboard
          adventureName={adventureName}
          season={season}
          onSeasonChange={onSeasonChange}
        />
        <AdventureNameForm
          initialName={adventureName}
          onAdventureOpen={onAdventureOpen}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      </div>
      <ActivityHeatmap adventureName={adventureName} season={season} />
      <WeeklyClearList adventureName={adventureName} />
    </div>
  )
}

function WeeklyClearBox({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <section
      aria-label="이번 주 클리어"
      className="min-w-0 overflow-x-auto rounded-panel border border-line bg-canvas"
    >
      {children}
    </section>
  )
}

function WeeklyClearList({ adventureName }: { adventureName: string }): React.JSX.Element {
  const result = useAdventureWeekly(adventureName)
  switch (result.status) {
    case 'loading':
      return (
        <WeeklyClearBox>
          <div aria-busy="true">
            <span role="status" className="sr-only">
              주간 던파를 받는 중입니다.
            </span>
            <WeeklyClearTable
              clearNames={[]}
              rows={[]}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} affiliations={[]} />
              ))}
            />
          </div>
        </WeeklyClearBox>
      )
    case 'error':
      return (
        <WeeklyClearBox>
          <p role="alert" className="m-0 p-4 text-sm text-fg-danger">
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
          <WeeklyClearTable clearNames={result.value.clearNames} rows={result.value.characters} />
        </WeeklyClearBox>
      )
  }
}
