import * as stylex from '@stylexjs/stylex'
import type { Run } from '../api/ops-schemas'
import { formatCount } from '../format'
import { styles } from './RunProgress.style'

type Progress = NonNullable<Run['progress']>

function progressPercent({ done, total }: Progress): number | undefined {
  if (total === null || total === 0) {
    return undefined
  }

  return Math.min(100, (done / total) * 100)
}

export function RunProgress({
  progress,
  wide = false
}: {
  progress: Progress
  wide?: boolean
}): React.JSX.Element {
  const percent = progressPercent(progress)
  const countText =
    progress.total !== null
      ? `${formatCount(progress.done)} / ${formatCount(progress.total)}`
      : formatCount(progress.done)

  return (
    <span {...stylex.props(styles.progress)}>
      {percent !== undefined && (
        <span aria-hidden="true" {...stylex.props(styles.track, wide && styles.wideTrack)}>
          <i {...stylex.props(styles.fill, styles.fillWidth(percent))} />
        </span>
      )}
      <b {...stylex.props(styles.count)}>{countText}</b>
    </span>
  )
}
