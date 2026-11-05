import * as stylex from '@stylexjs/stylex'
import { formatElapsedTime, formatSeoulDateTime } from '@dfragon/client-core/lib/time-format'
import { useElapsedTime } from '../hooks/useElapsedTime'

type RelativeTimeProps = { at: string; style?: stylex.StyleXStyles }

export function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  // 시각이 바뀌면 이전 시각의 타이머를 버리고 새 시각부터 다시 잰다.
  return <RelativeTimeValue key={props.at} {...props} />
}

function RelativeTimeValue({ at, style }: RelativeTimeProps): React.JSX.Element {
  const elapsed = useElapsedTime(Date.parse(at))

  return (
    <time dateTime={at} title={formatSeoulDateTime(at)} {...stylex.props(style)}>
      {formatElapsedTime(elapsed)}
    </time>
  )
}
