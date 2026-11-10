import { useCallback, useState } from 'react'
import type { TimelinePage } from '#core/character/character-timeline'

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
  first: readonly Item[]
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

function firstPage<Item>(first: readonly Item[], cursor: string | null): Received<Item> {
  return { first, items: first, cursor, state: stateOf(cursor) }
}

export function useTimelinePages<Item>(
  first: readonly Item[],
  firstCursor: string | null,
  fetchPage: (before: string) => Promise<TimelinePage<Item>>
): TimelinePages<Item> {
  const [received, setReceived] = useState(() => firstPage(first, firstCursor))
  // 캐시가 만료된 타임라인을 다시 받으면 첫 페이지가 바뀌므로, 이어 받은 페이지를 버리고 새 첫 페이지부터 보인다.
  if (received.first !== first) {
    setReceived(firstPage(first, firstCursor))
  }
  const { items, cursor, state } = received

  const loadMore = useCallback(() => {
    if (cursor === null || state.status === 'loading') {
      return
    }
    setReceived((current) => ({ ...current, state: { status: 'loading' } }))
    fetchPage(cursor).then(
      (page) =>
        setReceived((current) => {
          if (current.first !== first) {
            return current
          }
          const nextItems = [...current.items, ...page.items]
          const nextState = stateOf(page.nextCursor)

          return { first, items: nextItems, cursor: page.nextCursor, state: nextState }
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        setReceived((current) => {
          if (current.first !== first) {
            return current
          }

          return { ...current, state: { status: 'error', message } }
        })
      }
    )
  }, [first, cursor, state.status, fetchPage])

  return { items, state, loadMore }
}
