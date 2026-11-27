import type { PriceHistoryEntry } from '#ops-api/ops-schemas'
import { formatCount, formatDateMinute } from '#ops-app/format'
import { useLabCandidatePriceHistory } from '#ops-app/ops-queries'
import { MISSING_VALUE } from './lab-candidate-display'

const SPARKLINE_WIDTH = 320
const SPARKLINE_HEIGHT = 56
const SPARKLINE_BASELINE = 52
const SPARKLINE_LEFT = 8
const SPARKLINE_RIGHT = 312
const SPARKLINE_TOP = 10
const SPARKLINE_BOTTOM = 44

type Point = { x: number; y: number }

function sparklinePoints(prices: readonly number[]): Point[] {
  const min = Math.min(...prices)
  const span = Math.max(...prices) - min
  const step = (SPARKLINE_RIGHT - SPARKLINE_LEFT) / Math.max(prices.length - 1, 1)

  return prices.map((price, index) => {
    const x = prices.length > 1 ? SPARKLINE_LEFT + step * index : SPARKLINE_RIGHT
    const ratio = span > 0 ? (price - min) / span : 0.5
    const y = SPARKLINE_BOTTOM - ratio * (SPARKLINE_BOTTOM - SPARKLINE_TOP)

    return { x, y }
  })
}

function Sparkline({ prices }: { prices: readonly number[] }): React.JSX.Element {
  const points = sparklinePoints(prices)
  const last = points.at(-1)
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ')

  return (
    <svg
      role="img"
      aria-label="최저가 추이"
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      className="shrink-0"
    >
      <polyline
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="1"
        points={`0,${SPARKLINE_BASELINE} ${SPARKLINE_WIDTH},${SPARKLINE_BASELINE}`}
      />
      <polyline
        fill="none"
        stroke="var(--color-chart-1)"
        strokeWidth="2"
        strokeLinejoin="round"
        points={line}
      />
      {last !== undefined && <circle cx={last.x} cy={last.y} r="3" fill="var(--color-chart-1)" />}
    </svg>
  )
}

function HistoryList({ entries }: { entries: readonly PriceHistoryEntry[] }): React.JSX.Element {
  const prices = entries.flatMap(({ unitPrice }) => {
    if (unitPrice === null) {
      return []
    }

    return [unitPrice]
  })

  return (
    <div className="flex items-start gap-8 px-2 py-3">
      {prices.length > 0 && <Sparkline prices={prices} />}
      <dl className="m-0 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-xs">
        {entries.map(({ id, unitPrice, checkedAt }) => (
          <div key={id} className="contents">
            <dt className="text-fg-subtle">{formatDateMinute(checkedAt)}</dt>
            <dd className="num m-0">
              {unitPrice !== null ? formatCount(unitPrice) : MISSING_VALUE}
            </dd>
          </div>
        ))}
      </dl>
      <span className="text-xs text-fg-subtle">최근 200건까지, 값이 바뀐 시각만</span>
    </div>
  )
}

// 이력에는 값이 같아도 24시간마다 확인한 줄이 남으므로, 값이 이어지는 구간마다 가장 오래된 줄만 둔다.
function changedEntries(entries: readonly PriceHistoryEntry[]): PriceHistoryEntry[] {
  return entries.filter(
    (entry, index) => index === 0 || entries[index - 1].unitPrice !== entry.unitPrice
  )
}

function HistoryBody({ itemName }: { itemName: string }): React.JSX.Element {
  const history = useLabCandidatePriceHistory(itemName)

  if (history.isError) {
    return (
      <p role="alert" className="state state-error">
        가격 이력을 읽지 못했습니다.
      </p>
    )
  }

  if (history.data === undefined) {
    return (
      <div role="status" className="state state-pending">
        <span aria-hidden="true" className="loading-line">
          <span />
        </span>
      </div>
    )
  }

  if (history.data.history.length === 0) {
    return <p className="state">가격 이력이 없습니다.</p>
  }

  const entries = [...history.data.history].sort(
    (left, right) => left.checkedAt.getTime() - right.checkedAt.getTime()
  )

  return <HistoryList entries={changedEntries(entries)} />
}

export function PriceHistoryRow({
  itemName,
  columns
}: {
  itemName: string
  columns: number
}): React.JSX.Element {
  return (
    <tr>
      <td colSpan={columns} className="bg-surface">
        <HistoryBody itemName={itemName} />
      </td>
    </tr>
  )
}
