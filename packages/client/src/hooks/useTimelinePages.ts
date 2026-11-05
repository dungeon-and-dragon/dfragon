import { useCallback, useState } from 'react'
import type { TimelinePage } from '@dfragon/client-core/shared/search/character-timeline'

export type TimelinePagesState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; message: string }>
  | Readonly<{ status: 'end' }>

export type TimelinePages<Item> = Readonly<{
  items: readonly Item[]
  state: TimelinePagesState
  loadMore: () => void
}>

type Received<Item> = Readonly<{
  items: readonly Item[]
  cursor: string | null
  state: TimelinePagesState
}>

function stateOf(cursor: string | null): TimelinePagesState {
  if (cursor === null) {
    return { status: 'end' }
  }

  return { status: 'idle' }
}

export function useTimelinePages<Item>(
  first: readonly Item[],
  firstCursor: string | null,
  fetchPage: (before: string) => Promise<TimelinePage<Item>>
): TimelinePages<Item> {
  const [received, setReceived] = useState<Received<Item>>(() => ({
    items: first,
    cursor: firstCursor,
    state: stateOf(firstCursor)
  }))
  const { items, cursor, state } = received

  const loadMore = useCallback(() => {
    if (cursor === null || state.status === 'loading') {
      return
    }
    setReceived((current) => ({ ...current, state: { status: 'loading' } }))
    fetchPage(cursor).then(
      (page) =>
        setReceived((current) => ({
          items: [...current.items, ...page.items],
          cursor: page.nextCursor,
          state: stateOf(page.nextCursor)
        })),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        setReceived((current) => ({ ...current, state: { status: 'error', message } }))
      }
    )
  }, [cursor, state.status, fetchPage])

  return { items, state, loadMore }
}
