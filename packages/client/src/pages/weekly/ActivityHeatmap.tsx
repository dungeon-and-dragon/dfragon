import { Tabs } from '@base-ui/react/tabs'
import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import gsap from 'gsap'
import { type RefObject, useEffect, useRef, useState } from 'react'
import type { AdventureActivity } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { useAdventureActivity } from '../../hooks/useAdventureActivity'
import {
  type ActivityDay,
  type ActivityKind,
  buildHeatmapWeeks,
  dayCount,
  type HeatmapDay,
  type HeatmapWeek,
  heatLevel,
  levelThresholds,
  type RingHighlight,
  ringHighlight,
  type SeasonRange
} from './activity-heatmap'
import { ActivityDayDetail } from './ActivityDayDetail'
import { styles } from './ActivityHeatmap.style'
import { formatMonthDay } from './season-format'

const KINDS: readonly Readonly<{ kind: ActivityKind; label: string; cellLabel: string }>[] = [
  { kind: 'all', label: '전체', cellLabel: '활동' },
  { kind: 'raid', label: '레이드', cellLabel: '레이드 클리어' },
  { kind: 'legion', label: '레기온', cellLabel: '레기온 클리어' },
  { kind: 'item', label: '아이템', cellLabel: '아이템' },
  { kind: 'enhance', label: '강화', cellLabel: '강화 시도' }
]

const ROW_LABELS = ['목', '', '토', '', '월', '', '수']
const LEVEL_STYLES = [styles.empty, styles.level1, styles.level2, styles.level3, styles.level4]
const RING_TURN_SECONDS = 4

const RING_LABELS = { primeval: '태초', mythic: '신화' } as const

const numberFormat = new Intl.NumberFormat('ko-KR')

type CellPayload = Readonly<{ date: string; total: number }>
type CellTooltip = ReturnType<typeof Tooltip.createHandle<CellPayload>>

function isActivityKind(value: unknown): value is ActivityKind {
  return KINDS.some(({ kind }) => kind === value)
}

function unitOf(kind: ActivityKind): string {
  if (kind === 'item') {
    return '개'
  }

  return '회'
}

function cellLabel(kind: ActivityKind, date: string, day: ActivityDay | undefined): string {
  const { cellLabel: name } = KINDS.find((entry) => entry.kind === kind)!
  if (day === undefined) {
    return `${formatMonthDay(date)} ${name} 0`
  }

  const label = `${formatMonthDay(date)} ${name} ${dayCount(day, kind)}`

  const highlight = ringHighlight(day, kind)
  if (highlight === undefined) {
    return label
  }

  if (kind === 'enhance') {
    return `${label}, 10증폭이나 12강 이상 도전`
  }

  return `${label}, ${RING_LABELS[highlight]}`
}

function useRingRotation(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const element = ref.current
    if (!enabled || element == null) {
      return
    }

    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        element,
        { '--heatmap-ring-angle': 0 },
        { '--heatmap-ring-angle': 360, duration: RING_TURN_SECONDS, ease: 'none', repeat: -1 }
      )
    })

    return () => media.revert()
  }, [ref, enabled])
}

function Legend({
  kind,
  thresholds
}: {
  kind: ActivityKind
  thresholds: readonly number[]
}): React.JSX.Element | null {
  const top = thresholds.at(-1)
  if (top === undefined) {
    return null
  }

  return (
    <div aria-hidden="true" {...stylex.props(styles.legend)}>
      0
      {LEVEL_STYLES.map((level, index) => (
        <span key={index} {...stylex.props(styles.swatch, styles[kind], level)} />
      ))}
      {numberFormat.format(top)}
      {unitOf(kind)} 이상
    </div>
  )
}

function ItemTags({
  items
}: {
  items: AdventureActivity['summary']['items']
}): React.JSX.Element | null {
  if (items.legendary + items.epic + items.primeval + items.mythic === 0) {
    return null
  }

  return (
    <span {...stylex.props(styles.tags)}>
      {items.legendary > 0 && (
        <span {...stylex.props(styles.tag, styles.legendary)}>
          레전더리 {numberFormat.format(items.legendary)}
        </span>
      )}
      {items.epic > 0 && (
        <span {...stylex.props(styles.tag, styles.epic)}>
          에픽 {numberFormat.format(items.epic)}
        </span>
      )}
      {items.primeval > 0 && (
        <span {...stylex.props(styles.tag, styles.primordialTag)}>
          <span {...stylex.props(styles.primordialText)}>
            태초 {numberFormat.format(items.primeval)}
          </span>
        </span>
      )}
      {items.mythic > 0 && (
        <span {...stylex.props(styles.tag, styles.mythicTag)}>
          <span {...stylex.props(styles.mythicText)}>신화 {numberFormat.format(items.mythic)}</span>
        </span>
      )}
    </span>
  )
}

function Ring({ highlight }: { highlight: RingHighlight }): React.JSX.Element {
  return (
    <>
      <i aria-hidden="true" {...stylex.props(styles.ring, styles.glow, styles[highlight])} />
      <i aria-hidden="true" {...stylex.props(styles.ring, styles[highlight])} />
    </>
  )
}

function HeatmapCell({
  cell,
  kind,
  day,
  level,
  tooltip
}: {
  cell: HeatmapDay
  kind: ActivityKind
  day: ActivityDay | undefined
  level: number
  tooltip: CellTooltip
}): React.JSX.Element {
  if (cell.state === 'outside') {
    return <span aria-hidden="true" />
  }

  if (cell.state === 'future') {
    return <span aria-hidden="true" {...stylex.props(styles.cell, styles.future)} />
  }

  const props = {
    role: 'img',
    'aria-label': cellLabel(kind, cell.date, day),
    ...stylex.props(
      styles.cell,
      styles[kind],
      LEVEL_STYLES[level],
      cell.today && styles.today,
      day !== undefined && styles.active
    )
  }
  if (day === undefined) {
    return <span {...props} />
  }

  const highlight = ringHighlight(day, kind)

  return (
    <Tooltip.Trigger
      handle={tooltip}
      payload={{ date: cell.date, total: dayCount(day, 'all') }}
      delay={0}
      closeDelay={0}
      render={<span {...props} />}
    >
      {highlight !== undefined && <Ring highlight={highlight} />}
    </Tooltip.Trigger>
  )
}

function HeatmapGrid({
  kind,
  weeks,
  days,
  thresholds,
  tooltip
}: {
  kind: ActivityKind
  weeks: readonly HeatmapWeek[]
  days: ReadonlyMap<string, ActivityDay>
  thresholds: readonly number[]
  tooltip: CellTooltip
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const hasRing = [...days.values()].some((day) => ringHighlight(day, kind) !== undefined)
  useRingRotation(ref, hasRing)

  return (
    <div ref={ref} {...stylex.props(styles.grid, styles.columns(weeks.length))}>
      <span />
      {ROW_LABELS.map((label, index) => (
        <span key={index} aria-hidden="true" {...stylex.props(styles.label)}>
          {label}
        </span>
      ))}
      {weeks.flatMap((week, weekIndex) => [
        <span key={`month-${weekIndex}`} aria-hidden="true" {...stylex.props(styles.label)}>
          {week.month !== undefined && `${week.month}월`}
        </span>,
        ...week.days.map((cell, dayIndex) => {
          const day = cell.state === 'day' ? days.get(cell.date) : undefined

          return (
            <HeatmapCell
              key={`${weekIndex}-${dayIndex}`}
              cell={cell}
              kind={kind}
              day={day}
              level={day !== undefined ? heatLevel(dayCount(day, kind), thresholds) : 0}
              tooltip={tooltip}
            />
          )
        })
      ])}
    </div>
  )
}

function HeatmapPanel({
  adventureName,
  activity,
  season,
  kind,
  now
}: {
  adventureName: string
  activity: AdventureActivity
  season: SeasonRange
  kind: ActivityKind
  now: number
}): React.JSX.Element {
  const [tooltip] = useState(() => Tooltip.createHandle<CellPayload>())
  const weeks = buildHeatmapWeeks(season, now)
  const days = new Map(activity.days.map((day) => [day.date, day]))
  const thresholds = levelThresholds(activity.days.map((day) => dayCount(day, kind)))

  return (
    <>
      <div {...stylex.props(styles.head)}>
        {kind === 'item' && <ItemTags items={activity.summary.items} />}
        <Legend kind={kind} thresholds={thresholds} />
      </div>
      <div {...stylex.props(styles.gridArea)}>
        <HeatmapGrid
          kind={kind}
          weeks={weeks}
          days={days}
          thresholds={thresholds}
          tooltip={tooltip}
        />
      </div>
      <Tooltip.Root handle={tooltip}>
        {({ payload }) =>
          payload !== undefined && (
            <Tooltip.Popup side="top" sideOffset={8}>
              <ActivityDayDetail
                adventureName={adventureName}
                date={payload.date}
                total={payload.total}
              />
            </Tooltip.Popup>
          )
        }
      </Tooltip.Root>
    </>
  )
}

export function ActivityHeatmap({
  adventureName,
  season
}: {
  adventureName: string
  season: number | undefined
}): React.JSX.Element | null {
  const [kind, setKind] = useState<ActivityKind>('all')
  const [now] = useState(Date.now)
  const result = useAdventureActivity(adventureName, season)
  if (result.status === 'error') {
    return null
  }

  const activity = result.status === 'success' && !result.previous ? result.value : undefined
  if (activity === undefined) {
    return <div aria-hidden="true" {...stylex.props(styles.box, styles.skeleton)} />
  }

  const range = activity.season
  if (range === null) {
    return null
  }

  function handleValueChange(value: unknown): void {
    if (isActivityKind(value)) {
      setKind(value)
    }
  }

  return (
    <Tabs.Root
      value={kind}
      onValueChange={handleValueChange}
      orientation="vertical"
      render={<section aria-label="시즌 활동" />}
      {...stylex.props(styles.box)}
    >
      {KINDS.map(({ kind: panelKind }) => (
        <Tabs.Panel key={panelKind} value={panelKind} {...stylex.props(styles.panel)}>
          <HeatmapPanel
            adventureName={adventureName}
            activity={activity}
            season={range}
            kind={panelKind}
            now={now}
          />
        </Tabs.Panel>
      ))}
      <Tabs.List aria-label="활동 종류" {...stylex.props(styles.tabs)}>
        {KINDS.map(({ kind: tabKind, label }) => (
          <Tabs.Tab key={tabKind} value={tabKind} {...stylex.props(styles.tab)}>
            {label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator {...stylex.props(styles.indicator)} />
      </Tabs.List>
    </Tabs.Root>
  )
}
