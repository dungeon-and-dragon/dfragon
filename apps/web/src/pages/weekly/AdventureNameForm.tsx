import { Button, IconButton, RefreshIcon, SearchIcon, TextField, TextFieldInput } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { useRefreshAdventureActivity } from './api/useAdventureActivity'
import { useRefreshAdventureEquipment } from './api/useAdventureEquipment'
import { useRefreshAdventureWeekly } from './api/useAdventureWeekly'

export function AdventureNameForm({
  initialName,
  onAdventureOpen,
  refreshing = false,
  onRefresh,
  className = 'border-t border-line px-4 py-3 first:border-t-0'
}: {
  initialName: string
  className?: string
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
    <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-[224px] max-sm:min-w-0 max-sm:flex-1 [&_.field-input]:pr-8">
        <TextField size="sm">
          <TextFieldInput
            aria-label="모험단"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={handleDraftChange}
          />
        </TextField>
        <span className="absolute top-1/2 right-1 -translate-y-1/2">
          <IconButton
            type="submit"
            size="sm"
            aria-label="보기"
            icon={<SearchIcon className="size-icon-sm" />}
          />
        </span>
      </div>
      {onRefresh != null && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshIcon
            className={`size-icon-sm ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
          />
          {refreshing ? '받는 중' : '갱신'}
        </Button>
      )}
    </form>
  )
}

export function AdventureTabsForm({
  adventureName,
  onAdventureOpen
}: {
  adventureName: string
  onAdventureOpen: (adventureName: string) => void
}): React.JSX.Element {
  const refreshActivity = useRefreshAdventureActivity()
  const refreshWeekly = useRefreshAdventureWeekly()
  const refreshEquipment = useRefreshAdventureEquipment()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh(): Promise<void> {
    setRefreshing(true)
    await Promise.all([
      refreshActivity(adventureName),
      refreshWeekly(adventureName),
      refreshEquipment(adventureName)
    ])
    setRefreshing(false)
  }

  return (
    <AdventureNameForm
      initialName={adventureName}
      onAdventureOpen={onAdventureOpen}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      className="px-4 py-2 max-sm:w-full max-sm:border-t max-sm:border-line"
    />
  )
}
