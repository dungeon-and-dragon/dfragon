import { toElapsedTime } from '#shared/lib/time-format'
import { useRefreshingNow } from '#shared/lib/useRefreshingNow'

export function LastCaptureTime({ at }: { at: number | null }): React.JSX.Element {
  return (
    <div className="mr-2 flex h-8 shrink-0 items-center text-xs whitespace-nowrap">
      {/* 완료 시각이 바뀌면 이전 시각의 타이머를 버리고 새 시각부터 다시 잰다. */}
      {at !== null && <CaptureTimeValue key={at} at={at} />}
    </div>
  )
}

function CaptureTimeValue({ at }: { at: number }): React.JSX.Element {
  const time = toElapsedTime(useRefreshingNow(at) - at)

  return (
    <time dateTime={new Date(at).toISOString()} className="text-fg-muted">
      <span className="num text-sm font-semibold text-fg">{time.value}</span>
      {time.unit} 전
    </time>
  )
}
