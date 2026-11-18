import { useCallback, useState } from 'react'
import type { CharacterIdentity, CharacterTimeline } from '#core/character'
import { useCharacterTimeline } from '#pages/character/hooks/useCharacterTimeline'
import { LoadingLine } from '#components/LoadingLine'
import { useClientHost } from '#host/client-host'
import { type TimelinePages, useTimelinePages } from '#pages/character/hooks/useTimelinePages'
import type { CharacterTabProps } from './character-tab-props'
import {
  Acquisitions,
  Enhancements,
  SeasonClears,
  TimelineMore,
  WeeklyClears
} from './timeline/TimelineSections'

export function TimelineTab({ detail }: CharacterTabProps): React.JSX.Element {
  const result = useCharacterTimeline(detail)
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className="state state-pending">
          <LoadingLine />
          <span role="status">타임라인을 받는 중입니다. 처음 조회하면 몇 초 걸릴 수 있습니다.</span>
        </div>
      )
    case 'error':
      return (
        <p role="alert" className="state state-error">
          {result.message}
        </p>
      )
    case 'success': {
      const { serverId, characterId } = detail.character

      return <TimelineContent identity={{ serverId, characterId }} timeline={result.timeline} />
    }
  }
}

const ROWS_PER_STEP = 10

function useShownRows<Item>(pages: TimelinePages<Item>): {
  items: readonly Item[]
  more: React.JSX.Element
} {
  const [shown, setShown] = useState(ROWS_PER_STEP)
  const { items, state, loadMore } = pages
  const canShowMore = items.length > shown || state.status === 'idle'
  const shownItems = items.slice(0, shown)

  function showMore(): void {
    const next = shown + ROWS_PER_STEP

    setShown(next)

    if (items.length < next) {
      loadMore()
    }
  }

  const more = (
    <TimelineMore
      canShowMore={canShowMore}
      state={state}
      onShowMore={showMore}
      onRetry={loadMore}
    />
  )

  return { items: shownItems, more }
}

function TimelineContent({
  identity,
  timeline
}: {
  identity: CharacterIdentity
  timeline: CharacterTimeline
}): React.JSX.Element {
  const { getTimelineEnhancements, getTimelineAcquisitions } = useClientHost()
  const { serverId, characterId } = identity
  const enhancements = useTimelinePages(
    timeline.enhancements,
    timeline.enhancementsCursor,
    useCallback(
      (before: string) => getTimelineEnhancements({ serverId, characterId }, before),
      [getTimelineEnhancements, serverId, characterId]
    )
  )
  const acquisitions = useTimelinePages(
    timeline.acquisitions,
    timeline.acquisitionsCursor,
    useCallback(
      (before: string) => getTimelineAcquisitions({ serverId, characterId }, before),
      [getTimelineAcquisitions, serverId, characterId]
    )
  )

  const shownEnhancements = useShownRows(enhancements)
  const shownAcquisitions = useShownRows(acquisitions)

  return (
    <div className="flex flex-col divide-y divide-line text-sm">
      <WeeklyClears clears={timeline.weeklyClears} />
      <SeasonClears counts={timeline.seasonClears} />
      <div className="grid grid-cols-[minmax(0,1fr)_500px] divide-x divide-line max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
        <Enhancements enhancements={shownEnhancements.items} more={shownEnhancements.more} />
        <Acquisitions acquisitions={shownAcquisitions.items} more={shownAcquisitions.more} />
      </div>
    </div>
  )
}
