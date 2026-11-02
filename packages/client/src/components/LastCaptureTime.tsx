import * as stylex from '@stylexjs/stylex'
import { useElapsedTime } from '../hooks/useElapsedTime'
import { styles } from './LastCaptureTime.style'

export function LastCaptureTime({ at }: { at: number | null }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.root)}>
      {/* 완료 시각이 바뀌면 이전 시각의 타이머를 버리고 새 시각부터 다시 잰다. */}
      {at !== null && <CaptureTimeValue key={at} at={at} />}
    </div>
  )
}

function CaptureTimeValue({ at }: { at: number }): React.JSX.Element {
  const time = useElapsedTime(at)

  return (
    <time dateTime={new Date(at).toISOString()} {...stylex.props(styles.value)}>
      <span {...stylex.props(styles.number)}>{time.value}</span>
      {time.unit} 전
    </time>
  )
}
