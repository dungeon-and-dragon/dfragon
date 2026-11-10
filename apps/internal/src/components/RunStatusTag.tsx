import * as stylex from '@stylexjs/stylex'
import type { RunStatus } from '../api/ops-schemas'
import { STATUS_LABELS } from '../format'
import { styles } from './RunStatusTag.style'

export function RunStatusTag({ status }: { status: RunStatus }): React.JSX.Element {
  return <span {...stylex.props(styles.tag, styles[status])}>{STATUS_LABELS[status]}</span>
}

export function PausedTag(): React.JSX.Element {
  return <span {...stylex.props(styles.tag, styles.paused)}>정지</span>
}
