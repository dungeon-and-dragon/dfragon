import { shapes } from '@dfragon/ui'
import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
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
import { styles } from './history/HistoryTab.style'

const CHART_HEIGHT = 226
const CHART_BONE_HEIGHT = 296
const POINT_BONE_HEIGHT = 48
const POINT_BONE_COUNT = 4
const SUMMARY_BONE_HEIGHT = 216
const TILE_BONE_HEIGHT = 64
const TILE_COUNT = 4
const CHANGE_BONE_HEIGHTS = [32, 38, 38, 38]

type ScoreLabel = ReturnType<typeof toScoreView>['label']

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
        <div {...stylex.props(styles.message)}>
          <p role="alert" {...stylex.props(styles.error)}>
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
  const scoreTone = calculator === 'buff' ? styles.buffer : styles.dealer

  if (selected === undefined) {
    return (
      <div>
        <p {...stylex.props(styles.empty)}>저장된 이력이 없습니다.</p>
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
      <div {...stylex.props(styles.points)}>
        <ul {...stylex.props(styles.pointList)}>
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
  scoreTone: stylex.StyleXStyles
  onSelect: (observedAt: string) => void
}): React.JSX.Element {
  function handleClick(): void {
    onSelect(point.observedAt)
  }

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={handleClick}
        {...stylex.props(styles.point, selected && styles.pointSelected)}
      >
        <span {...stylex.props(styles.pointTime, selected && styles.pointTimeSelected)}>
          {time}
        </span>
        <span {...stylex.props(styles.pointParts)}>{partsText(point)}</span>
        <span {...stylex.props(styles.pointValues)}>
          <span {...stylex.props(styles.fame)}>{formatOptional(point.fame)}</span>
          <span {...stylex.props(scoreTone)}>{formatOptional(point.score)}</span>
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
    { key: 'fame', name: '명성', color: colors.gameFame, values: fames },
    { key: 'score', name: scoreLabel, color: colors.chart1, values: scores }
  ]

  return (
    <div {...stylex.props(styles.charts)}>
      {charts.map((series) => (
        <section
          key={series.key}
          aria-label={`${series.name} 추이`}
          {...stylex.props(styles.panel)}
        >
          <div {...stylex.props(styles.strip)}>
            <h3 {...stylex.props(styles.stripTitle)}>{series.name}</h3>
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
  scoreTone: stylex.StyleXStyles
  time: string
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.summary)}>
      <div {...stylex.props(styles.strip)}>
        <b {...stylex.props(styles.stripTime)}>{time}</b>
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
  scoreTone: stylex.StyleXStyles
}): React.JSX.Element {
  const current = useHistorySnapshot(identity, point.observedAt)
  const before = useHistorySnapshot(identity, previous?.observedAt ?? null)

  if (current.status === 'error' || before.status === 'error') {
    return (
      <div {...stylex.props(styles.message)}>
        <p role="alert" {...stylex.props(styles.error)}>
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
      <dl {...stylex.props(styles.tiles)}>
        <Tile
          label="명성"
          value={formatOptional(point.fame)}
          tone={styles.fame}
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
  tone?: stylex.StyleXStyles
  delta: Delta
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.tile)}>
      <dt {...stylex.props(styles.tileLabel)}>{label}</dt>
      <dd {...stylex.props(styles.tileValue, tone)}>{value}</dd>
      <dd
        {...stylex.props(
          styles.tileDelta,
          delta.direction === 'up' && styles.up,
          delta.direction === 'down' && styles.down
        )}
      >
        {delta.text}
      </dd>
    </div>
  )
}

function Bone({ height }: { height: number }): React.JSX.Element {
  return <span {...stylex.props(styles.bone, styles.boneHeight(height))} />
}

function HistorySkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true">
      <span role="status" {...stylex.props(shapes.srOnly)}>
        이력을 받는 중입니다.
      </span>
      <div aria-hidden="true" {...stylex.props(styles.skeletonCharts)}>
        <Bone height={CHART_BONE_HEIGHT} />
        <Bone height={CHART_BONE_HEIGHT} />
      </div>
      <div aria-hidden="true" {...stylex.props(styles.skeletonBody)}>
        <div {...stylex.props(styles.skeletonColumn)}>
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
      <span role="status" {...stylex.props(shapes.srOnly)}>
        시점 요약을 받는 중입니다.
      </span>
      <div aria-hidden="true" {...stylex.props(styles.skeletonTiles)}>
        {Array.from({ length: TILE_COUNT }, (_, index) => (
          <Bone key={index} height={TILE_BONE_HEIGHT} />
        ))}
      </div>
      <div aria-hidden="true" {...stylex.props(styles.skeletonRows)}>
        {CHANGE_BONE_HEIGHTS.map((height, index) => (
          <Bone key={index} height={height} />
        ))}
      </div>
    </div>
  )
}
