import type { RunStatus } from '#ops-api/ops-schemas'
import { STATUS_LABELS } from '#app/format'

type StatusTone = 'neutral' | 'signal' | 'success' | 'danger' | 'warning'

// status-chip-sm의 좌우 여백은 앞에 둘 점 몫으로 다르다. 점 없이 쓰므로 좌우를 같게 맞춘다.
const TAG = 'status-chip status-chip-sm shrink-0 px-2'

const RUN_STATUS_TONES = {
  requested: 'neutral',
  running: 'signal',
  succeeded: 'success',
  failed: 'danger',
  interrupted: 'warning'
} as const satisfies Record<RunStatus, StatusTone>

export function RunStatusTag({ status }: { status: RunStatus }): React.JSX.Element {
  return (
    <span className={TAG} data-tone={RUN_STATUS_TONES[status]}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PausedTag(): React.JSX.Element {
  return (
    <span className={TAG} data-tone="neutral">
      정지
    </span>
  )
}

const BATCH_KEY_STATUS_LABELS = {
  enabled: '사용',
  disabled: '꺼짐',
  rejected: '거절됨'
} as const

export type BatchKeyStatus = keyof typeof BATCH_KEY_STATUS_LABELS

const BATCH_KEY_STATUS_TONES = {
  enabled: 'success',
  disabled: 'neutral',
  rejected: 'danger'
} as const satisfies Record<BatchKeyStatus, StatusTone>

export function BatchKeyStatusTag({ status }: { status: BatchKeyStatus }): React.JSX.Element {
  return (
    <span className={TAG} data-tone={BATCH_KEY_STATUS_TONES[status]}>
      {BATCH_KEY_STATUS_LABELS[status]}
    </span>
  )
}
