import { useCallback } from 'react'
import type { CharacterIdentity } from '#core/character/character'
import type { CharacterTimeline } from '#core/character/character-timeline'
import { useCharacterTimeline } from '../hooks/useCharacterTimeline'
import { LoadingLine } from '../../../components/LoadingLine'
import { useClientHost } from '../../../host/client-host'
import { useTimelinePages } from '../hooks/useTimelinePages'
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

  return (
    <div className="flex flex-col divide-y divide-line text-sm">
      <WeeklyClears clears={timeline.weeklyClears} />
      <SeasonClears counts={timeline.seasonClears} />
      <div className="grid grid-cols-[minmax(0,1fr)_500px] divide-x divide-line max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
        <Enhancements enhancements={enhancements.items} more={<TimelineMore {...enhancements} />} />
        <Acquisitions acquisitions={acquisitions.items} more={<TimelineMore {...acquisitions} />} />
      </div>
    </div>
  )
}
