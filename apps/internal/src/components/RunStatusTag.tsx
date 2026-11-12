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

const BATCH_KEY_STATUS_LABELS = {
  enabled: '사용',
  disabled: '꺼짐',
  rejected: '거절됨'
} as const

export type BatchKeyStatus = keyof typeof BATCH_KEY_STATUS_LABELS

const BATCH_KEY_STATUS_STYLES = {
  enabled: styles.succeeded,
  disabled: styles.paused,
  rejected: styles.failed
} as const satisfies Record<BatchKeyStatus, unknown>

export function BatchKeyStatusTag({ status }: { status: BatchKeyStatus }): React.JSX.Element {
  return (
    <span {...stylex.props(styles.tag, BATCH_KEY_STATUS_STYLES[status])}>
      {BATCH_KEY_STATUS_LABELS[status]}
    </span>
  )
}
