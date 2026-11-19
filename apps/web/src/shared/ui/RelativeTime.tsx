import { formatSeoulDateTime, formatTimeAgo } from '#shared/lib/time-format'
import { useRefreshingNow } from '#shared/lib/useRefreshingNow'

type RelativeTimeProps = { at: string; className?: string }

export function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  // 시각이 바뀌면 이전 시각의 타이머를 버리고 새 시각부터 다시 잰다.
  return <RelativeTimeValue key={props.at} {...props} />
}

function RelativeTimeValue({ at, className }: RelativeTimeProps): React.JSX.Element {
  const now = useRefreshingNow(Date.parse(at))

  return (
    <time dateTime={at} title={formatSeoulDateTime(at, now)} className={className}>
      {formatTimeAgo(at, now)}
    </time>
  )
}
