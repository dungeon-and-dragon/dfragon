import type { Run } from '../api/ops-schemas'
import { formatCount } from '../format'

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
    <span className="inline-flex items-center gap-2">
      {percent !== undefined && (
        <span
          aria-hidden="true"
          className={`shrink-0 overflow-hidden rounded-badge bg-control ${wide ? 'h-2 w-[320px] max-sm:w-[160px]' : 'h-[6px] w-[88px]'}`}
        >
          <i className="block h-full bg-fg-muted" style={{ width: `${percent}%` }} />
        </span>
      )}
      <b className="num font-medium">{countText}</b>
    </span>
  )
}
