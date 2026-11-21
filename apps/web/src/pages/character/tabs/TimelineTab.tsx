import { useState } from 'react'
import type { CharacterIdentity, CharacterTimeline } from '#entities/character'
import {
  useCharacterTimeline,
  useTimelineAcquisitions,
  useTimelineEnhancements
} from '#pages/character/api/useCharacterTimeline'
import { LoadingLine } from '#shared/ui/LoadingLine'
import type { TimelinePages } from '#pages/character/hooks/useTimelinePages'
import type { CharacterTabProps } from './character-tab-props'
import { Acquisitions, Enhancements, SeasonClears, TimelineMore } from './timeline/TimelineSections'

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
  const enhancements = useTimelineEnhancements(identity, timeline)
  const acquisitions = useTimelineAcquisitions(identity, timeline)

  const shownEnhancements = useShownRows(enhancements)
  const shownAcquisitions = useShownRows(acquisitions)

  return (
    <div className="flex flex-col divide-y divide-line text-sm">
      <SeasonClears counts={timeline.seasonClears} />
      <div className="grid grid-cols-[minmax(0,1fr)_500px] divide-x divide-line max-md:grid-cols-1 max-md:divide-x-0 max-md:divide-y">
        <Enhancements enhancements={shownEnhancements.items} more={shownEnhancements.more} />
        <Acquisitions acquisitions={shownAcquisitions.items} more={shownAcquisitions.more} />
      </div>
    </div>
  )
}
