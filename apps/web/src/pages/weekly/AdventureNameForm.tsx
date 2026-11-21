import { Button, IconButton, RefreshIcon, SearchIcon, TextField, TextFieldInput } from '@dfragon/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { useRefreshAdventureActivity } from './api/useAdventureActivity'
import { useRefreshAdventureEquipment } from './api/useAdventureEquipment'
import { useRefreshAdventureWeekly } from './api/useAdventureWeekly'

export function AdventureNameForm({
  initialName,
  onAdventureOpen,
  refreshing = false,
  refreshDisabled = false,
  onRefresh,
  className = 'border-t border-line px-4 py-3 first:border-t-0'
}: {
  initialName: string
  className?: string
  onAdventureOpen: (adventureName: string) => void
  refreshing?: boolean
  refreshDisabled?: boolean
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
          disabled={refreshing || refreshDisabled}
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
  const { refreshedAt, markRefreshed } = useRefreshedAt(adventureName)
  const coolingDown = useCoolingDown(refreshedAt)

  async function handleRefresh(): Promise<void> {
    markRefreshed(Date.now())
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
      refreshDisabled={coolingDown}
      onRefresh={handleRefresh}
      className="px-4 py-2 max-sm:w-full max-sm:border-t max-sm:border-line"
    />
  )
}

const REFRESH_COOLDOWN_MS = 5 * 60_000

function refreshedAtKey(adventureName: string) {
  return ['adventure', adventureName, 'refreshed-at'] as const
}

// 탭을 옮기면 버튼이 다시 그려지므로, 마지막으로 누른 시각을 모험단별로 query 캐시에 둔다.
function useRefreshedAt(adventureName: string): {
  refreshedAt: number | null | undefined
  markRefreshed: (at: number) => void
} {
  const queryClient = useQueryClient()
  const key = refreshedAtKey(adventureName)
  const { data } = useQuery<number | null>({
    queryKey: key,
    queryFn: () => null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY
  })

  function markRefreshed(at: number): void {
    queryClient.setQueryData(key, at)
  }

  return { refreshedAt: data, markRefreshed }
}

function useCoolingDown(refreshedAt: number | null | undefined): boolean {
  const [cooledAt, setCooledAt] = useState<number>()

  useEffect(() => {
    if (refreshedAt == null) {
      return
    }

    const timer = window.setTimeout(
      () => setCooledAt(refreshedAt),
      refreshedAt + REFRESH_COOLDOWN_MS - Date.now()
    )

    return () => window.clearTimeout(timer)
  }, [refreshedAt])

  return refreshedAt != null && cooledAt !== refreshedAt
}
