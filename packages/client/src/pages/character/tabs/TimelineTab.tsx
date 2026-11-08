import { ProgressCircle } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useCallback } from 'react'
import type { CharacterIdentity } from '@dfragon/client-core/preload/common/types/character'
import type { CharacterTimeline } from '@dfragon/client-core/shared/search/character-timeline'
import { useCharacterTimeline } from '../../../hooks/useCharacterTimeline'
import { useClientHost } from '../../../host/client-host'
import { useTimelinePages } from '../../../hooks/useTimelinePages'
import type { CharacterTabProps } from './character-tab-props'
import {
  Acquisitions,
  Enhancements,
  SeasonClears,
  TimelineMore,
  WeeklyClears
} from './timeline/TimelineSections'
import { styles } from './timeline/TimelineTab.style'

export function TimelineTab({ detail }: CharacterTabProps): React.JSX.Element {
  const result = useCharacterTimeline(detail)
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" {...stylex.props(styles.state)}>
          <ProgressCircle size="24" tone="neutral" aria-hidden="true" />
          <span role="status">타임라인을 받는 중입니다. 처음 조회하면 몇 초 걸릴 수 있습니다.</span>
        </div>
      )
    case 'error':
      return (
        <div {...stylex.props(styles.state, styles.error)}>
          <p role="alert">{result.message}</p>
        </div>
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
    <div {...stylex.props(styles.root)}>
      <WeeklyClears clears={timeline.weeklyClears} />
      <SeasonClears counts={timeline.seasonClears} />
      <div {...stylex.props(styles.columns)}>
        <Enhancements enhancements={enhancements.items} more={<TimelineMore {...enhancements} />} />
        <Acquisitions acquisitions={acquisitions.items} more={<TimelineMore {...acquisitions} />} />
      </div>
    </div>
  )
}
