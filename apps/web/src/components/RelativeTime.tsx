import * as stylex from '@stylexjs/stylex'
import { formatSeoulDateTime, formatTimeAgo } from '#core/lib/time-format'
import { useRefreshingNow } from '../hooks/useRefreshingNow'

type RelativeTimeProps = { at: string; style?: stylex.StyleXStyles }

export function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  // 시각이 바뀌면 이전 시각의 타이머를 버리고 새 시각부터 다시 잰다.
  return <RelativeTimeValue key={props.at} {...props} />
}

function RelativeTimeValue({ at, style }: RelativeTimeProps): React.JSX.Element {
  const now = useRefreshingNow(Date.parse(at))

  return (
    <time dateTime={at} title={formatSeoulDateTime(at, now)} {...stylex.props(style)}>
      {formatTimeAgo(at, now)}
    </time>
  )
}
