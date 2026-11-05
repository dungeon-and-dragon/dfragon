import { ProgressCircle } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useCharacterTimeline } from '../../../hooks/useCharacterTimeline'
import type { CharacterTabProps } from './character-tab-props'
import { Acquisitions, Enhancements, SeasonClears, WeeklyClears } from './timeline/TimelineSections'
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
      const { weeklyClears, seasonClears, enhancements, acquisitions } = result.timeline

      return (
        <div {...stylex.props(styles.root)}>
          <WeeklyClears clears={weeklyClears} />
          <SeasonClears counts={seasonClears} />
          <div {...stylex.props(styles.columns)}>
            <Enhancements enhancements={enhancements} />
            <Acquisitions acquisitions={acquisitions} />
          </div>
        </div>
      )
    }
  }
}
