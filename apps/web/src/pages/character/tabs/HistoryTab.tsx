import { useState } from 'react'
import { toScoreView } from '#core/character/card-score'
import type { CharacterIdentity } from '#core/character/character'
import {
  type CharacterHistory,
  type HistoryPoint,
  type ScoreCalculator,
  toHistoryPoints,
  toHistorySnapshotSummary
} from '#core/character/character-history'
import { formatPoint } from '#core/character/character-item'
import { formatSeoulDateTime } from '#core/time-format'
import { LineChart } from '../../../components/chart/LineChart'
import { useCharacterHistory, useHistorySnapshot } from '../hooks/useCharacterHistory'
import type { CharacterTabProps } from './character-tab-props'
import { historyTimeAxis } from './history/history-chart'
import { type Delta, deltaOf, formatOptional, integer, MISSING } from './history/history-format'
import { Heading, HistoryChanges, NameChanges } from './history/HistorySections'

const CHART_HEIGHT = 226
const CHART_BONE_HEIGHT = 296
const POINT_BONE_HEIGHT = 48
const POINT_BONE_COUNT = 4
const SUMMARY_BONE_HEIGHT = 216
const TILE_BONE_HEIGHT = 64
const TILE_COUNT = 4
const CHANGE_BONE_HEIGHTS = [32, 38, 38, 38]

type ScoreLabel = ReturnType<typeof toScoreView>['label']

const LINE = 'border-b border-line'
const POINT_COLUMNS = 'grid grid-cols-[400px_minmax(0,1fr)] max-sm:grid-cols-1'
const FAME = 'text-game-fame'
const STRIP = `box-border flex min-h-12 items-center px-4 py-2 ${LINE}`
const DELTA_TONES = { up: 'text-game-increase', down: 'text-game-decrease' } as const
const POINT =
  'relative box-border flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-none px-4 py-2 text-left text-sm text-fg focus-ring-inset'
const POINT_IDLE = 'hover:bg-surface'
const POINT_SELECTED =
  'bg-surface before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-signal'

export function HistoryTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { serverId, characterId } = detail.character
  const identity = { serverId, characterId }
  const result = useCharacterHistory(identity)
  const { label } = toScoreView(detail.card)
  const calculator = detail.card?.role === 'buffer' ? 'buff' : 'equipment'

  switch (result.status) {
    case 'loading':
      return <HistorySkeleton />
    case 'error':
      return (
        <div className="p-4">
          <p role="alert" className="m-0 text-sm text-fg-danger">
            이력을 받지 못했습니다.
          </p>
        </div>
      )
    case 'success':
      return (
        <HistoryContent
          key={`${serverId}/${characterId}`}
          identity={identity}
          history={result.value}
          calculator={calculator}
          scoreLabel={label}
        />
      )
  }
}

function HistoryContent({
  identity,
  history,
  calculator,
  scoreLabel
}: {
  identity: CharacterIdentity
  history: CharacterHistory
  calculator: ScoreCalculator
  scoreLabel: ScoreLabel
}): React.JSX.Element {
  const [now] = useState(Date.now)
  const [selectedAt, setSelectedAt] = useState<string | null>(null)
  const points = toHistoryPoints(history, calculator)
  const selectedIndex = Math.max(
    0,
    points.findIndex(({ observedAt }) => observedAt === selectedAt)
  )
  const selected = points[selectedIndex]
  const scoreTone = calculator === 'buff' ? 'text-score-buffer' : 'text-score-dealer'

  if (selected === undefined) {
    return (
      <div>
        <p className={`m-0 px-4 py-12 text-center text-sm font-semibold ${LINE}`}>
          저장된 이력이 없습니다.
        </p>
        <NameChanges changes={history.nameChanges} />
      </div>
    )
  }

  function formatTime(at: string): string {
    return formatSeoulDateTime(at, now)
  }

  return (
    <div>
      {points.length > 1 && (
        <HistoryCharts
          points={points}
          selected={selected}
          scoreLabel={scoreLabel}
          formatTime={formatTime}
        />
      )}
      <Heading title="시점" count={points.length} />
      <div className={`${POINT_COLUMNS} ${LINE}`}>
        <ul className="m-0 flex list-none flex-col border-e border-line p-0 max-sm:border-e-0">
          {points.map((point) => (
            <PointButton
              key={point.observedAt}
              point={point}
              selected={point === selected}
              time={formatTime(point.observedAt)}
              scoreTone={scoreTone}
              onSelect={setSelectedAt}
            />
          ))}
        </ul>
        <PointSummary
          identity={identity}
          point={selected}
          previous={points[selectedIndex + 1]}
          scoreLabel={scoreLabel}
          scoreTone={scoreTone}
          time={formatTime(selected.observedAt)}
        />
      </div>
      <NameChanges changes={history.nameChanges} />
    </div>
  )
}

function PointButton({
  point,
  selected,
  time,
  scoreTone,
  onSelect
}: {
  point: HistoryPoint
  selected: boolean
  time: string
  scoreTone: string
  onSelect: (observedAt: string) => void
}): React.JSX.Element {
  function handleClick(): void {
    onSelect(point.observedAt)
  }

  return (
    <li className={LINE}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={handleClick}
        className={`${POINT} ${selected ? POINT_SELECTED : POINT_IDLE}`}
      >
        <span
          className={`w-[96px] shrink-0 font-mono tabular-nums ${selected ? 'font-semibold text-fg' : 'font-medium text-fg-muted'}`}
        >
          {time}
        </span>
        <span className="min-w-0 truncate text-xs text-fg-muted">{partsText(point)}</span>
        <span className="ms-auto flex flex-col items-end font-mono text-xs tabular-nums">
          <span className={FAME}>{formatOptional(point.fame)}</span>
          <span className={scoreTone}>{formatOptional(point.score)}</span>
        </span>
      </button>
    </li>
  )
}

function partsText(point: HistoryPoint): string {
  if (point.first) {
    return '첫 기록'
  }

  return point.parts.join(', ')
}

function HistoryCharts({
  points,
  selected,
  scoreLabel,
  formatTime
}: {
  points: readonly HistoryPoint[]
  selected: HistoryPoint
  scoreLabel: ScoreLabel
  formatTime: (at: string) => string
}): React.JSX.Element {
  const ordered = points.toReversed()
  const x = ordered.map(({ observedAt }) => {
    const title = formatTime(observedAt)
    const at = Date.parse(observedAt)

    return { key: observedAt, title, tick: null, at }
  })
  const timeAxis = historyTimeAxis(x.map(({ at }) => at))
  const fames = ordered.map(({ fame }) => fame)
  const scores = ordered.map(({ score }) => score)
  const charts = [
    { key: 'fame', name: '명성', color: 'var(--color-game-fame)', values: fames },
    { key: 'score', name: scoreLabel, color: 'var(--color-chart-1)', values: scores }
  ]

  return (
    <div className={`grid grid-cols-2 gap-4 p-4 max-sm:grid-cols-1 ${LINE}`}>
      {charts.map((series) => (
        <section
          key={series.key}
          aria-label={`${series.name} 추이`}
          className="flex min-w-0 flex-col rounded-panel border border-line bg-canvas"
        >
          <div className={STRIP}>
            <h3 className="m-0 text-sm font-semibold">{series.name}</h3>
          </div>
          <LineChart
            label={`${series.name} 추이`}
            x={x}
            series={[series]}
            formatTick={integer.format}
            formatValue={integer.format}
            height={CHART_HEIGHT}
            timeAxis={timeAxis}
            selectedKey={selected.observedAt}
            fitValues
          />
        </section>
      ))}
    </div>
  )
}

function PointSummary({
  identity,
  point,
  previous,
  scoreLabel,
  scoreTone,
  time
}: {
  identity: CharacterIdentity
  point: HistoryPoint
  previous: HistoryPoint | undefined
  scoreLabel: ScoreLabel
  scoreTone: string
  time: string
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className={STRIP}>
        <b className="font-mono text-sm font-semibold tabular-nums">{time}</b>
      </div>
      <SummaryBody
        identity={identity}
        point={point}
        previous={previous}
        scoreLabel={scoreLabel}
        scoreTone={scoreTone}
      />
    </div>
  )
}

function SummaryBody({
  identity,
  point,
  previous,
  scoreLabel,
  scoreTone
}: {
  identity: CharacterIdentity
  point: HistoryPoint
  previous: HistoryPoint | undefined
  scoreLabel: ScoreLabel
  scoreTone: string
}): React.JSX.Element {
  const current = useHistorySnapshot(identity, point.observedAt)
  const before = useHistorySnapshot(identity, previous?.observedAt ?? null)

  if (current.status === 'error' || before.status === 'error') {
    return (
      <div className="p-4">
        <p role="alert" className="m-0 text-sm text-fg-danger">
          시점 요약을 받지 못했습니다.
        </p>
      </div>
    )
  }

  if (current.status === 'loading' || before.status === 'loading' || current.value === null) {
    return <SummarySkeleton />
  }

  const summary = toHistorySnapshotSummary(current.value)
  const previousSummary = before.value !== null ? toHistorySnapshotSummary(before.value) : null
  const setPoint = summary.setPoint !== null ? formatPoint(summary.setPoint) : MISSING
  const mistLevel = summary.mistLevel !== null ? `Lv.${summary.mistLevel}` : MISSING

  return (
    <>
      <dl className={`m-0 grid grid-cols-4 max-sm:grid-cols-2 ${LINE}`}>
        <Tile
          label="명성"
          value={formatOptional(point.fame)}
          tone={FAME}
          delta={deltaOf(point.fame, previous?.fame)}
        />
        <Tile
          label={scoreLabel}
          value={formatOptional(point.score)}
          tone={scoreTone}
          delta={deltaOf(point.score, previous?.score)}
        />
        <Tile
          label="세트 포인트"
          value={setPoint}
          delta={deltaOf(summary.setPoint, previousSummary?.setPoint, formatPoint)}
        />
        <Tile
          label="안개 융화"
          value={mistLevel}
          delta={deltaOf(summary.mistLevel, previousSummary?.mistLevel)}
        />
      </dl>
      <HistoryChanges point={point} />
    </>
  )
}

function Tile({
  label,
  value,
  tone,
  delta
}: {
  label: string
  value: string
  tone?: string
  delta: Delta
}): React.JSX.Element {
  const deltaTone = delta.direction !== null ? DELTA_TONES[delta.direction] : 'text-fg-subtle'

  return (
    <div className="m-0 flex flex-col gap-1 border-s border-line p-4 first:border-s-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className={`m-0 font-mono text-xl leading-8 font-semibold tabular-nums ${tone ?? ''}`}>
        {value}
      </dd>
      <dd className={`ms-0 mt-1 text-right font-mono text-2xs tabular-nums ${deltaTone}`}>
        {delta.text}
      </dd>
    </div>
  )
}

function Bone({ height }: { height: number }): React.JSX.Element {
  return <span className="block rounded-control bg-surface" style={{ height }} />
}

function HistorySkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">
        이력을 받는 중입니다.
      </span>
      <div aria-hidden="true" className={`grid grid-cols-2 gap-4 p-4 ${LINE}`}>
        <Bone height={CHART_BONE_HEIGHT} />
        <Bone height={CHART_BONE_HEIGHT} />
      </div>
      <div aria-hidden="true" className={`${POINT_COLUMNS} gap-4 p-4`}>
        <div className="flex flex-col gap-2">
          {Array.from({ length: POINT_BONE_COUNT }, (_, index) => (
            <Bone key={index} height={POINT_BONE_HEIGHT} />
          ))}
        </div>
        <Bone height={SUMMARY_BONE_HEIGHT} />
      </div>
    </div>
  )
}

function SummarySkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">
        시점 요약을 받는 중입니다.
      </span>
      <div aria-hidden="true" className={`grid grid-cols-4 gap-2 p-4 ${LINE}`}>
        {Array.from({ length: TILE_COUNT }, (_, index) => (
          <Bone key={index} height={TILE_BONE_HEIGHT} />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2 p-4">
        {CHANGE_BONE_HEIGHTS.map((height, index) => (
          <Bone key={index} height={height} />
        ))}
      </div>
    </div>
  )
}
