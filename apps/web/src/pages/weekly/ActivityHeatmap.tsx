import { Tabs } from '@base-ui/react/tabs'
import { Tooltip } from '@dfragon/ui'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import type { ActivitySummary, AdventureActivity } from '#entities/adventure-guild'
import { enhancementTextClasses, rarityTextClasses, raritySolidClasses } from '#entities/character'
import {
  type AdventureActivitySeasonDaysResult,
  useAdventureActivity,
  useAdventureActivitySeasonDays
} from './api/useAdventureActivity'
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
import { useHeatmapRingSpin } from './animations/useHeatmapRingSpin'
import { useHeatmapTooltipSlide } from './animations/useHeatmapTooltipSlide'
import { useHeatmapWheelScroll } from './animations/useHeatmapWheelScroll'
import { formatMonthDay } from './season-format'
import { seasonHasLegion } from './season-legion'
import { seasonHasOaths } from './season-oath'
import { type RarityCounts, rarityTotal } from './rarity-counts'

const KINDS: readonly Readonly<{ kind: ActivityKind; label: string; cellLabel: string }>[] = [
  { kind: 'all', label: '전체', cellLabel: '활동' },
  { kind: 'raid', label: '레이드', cellLabel: '레이드 클리어' },
  { kind: 'legion', label: '레기온', cellLabel: '레기온 클리어' },
  { kind: 'item', label: '아이템', cellLabel: '아이템' },
  { kind: 'enhance', label: '강화', cellLabel: '강화 시도' }
]

const ROW_LABELS = ['목', '', '토', '', '월', '', '수']

const KIND_TONES: Readonly<Record<ActivityKind, string>> = {
  all: 'text-fg',
  raid: 'text-fg-success',
  legion: 'text-fg-success',
  item: raritySolidClasses.epic,
  enhance: enhancementTextClasses.enhance
}
const LEVEL_FILLS = [
  'bg-inset',
  'bg-[color-mix(in_srgb,currentColor_22%,var(--color-inset))]',
  'bg-[color-mix(in_srgb,currentColor_46%,var(--color-inset))]',
  'bg-[color-mix(in_srgb,currentColor_73%,var(--color-inset))]',
  'bg-current'
]

// GitHub contribution 그래프처럼 칸 크기를 고정하고, 범례 견본과 같은 12px로 둔다.
const CELL = 'relative box-border block size-3 rounded-control'
const ROWS = 'grid-rows-[14px_repeat(7,12px)]'
const LABEL = 'text-2xs whitespace-nowrap text-fg-subtle'
const TAG = 'badge badge-sm border border-current tabular-nums'
// 600px 미만에서는 활동 종류 탭을 히트맵 위 가로 줄로 둔다.
const BOX =
  'section grid grid-cols-[minmax(0,1fr)_120px] xl:grid-cols-[minmax(0,1fr)] py-0 max-sm:grid-cols-[minmax(0,1fr)]'

// gsap이 heatmap 격자에 --heatmap-ring-angle을 돌리고, 테두리가 상속받아 각도로 쓴다.
const RING =
  'pointer-events-none absolute rounded-[3px] [mask-clip:content-box,border-box] [mask-composite:exclude] [mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)]'
const RING_FRAMES: Readonly<Record<'frame' | 'glow', string>> = {
  frame: '-inset-[3px] p-[2px]',
  glow: '-inset-1 p-[3px] opacity-35 blur-[3px]'
}
const RING_FILLS: Readonly<Record<RingHighlight, string>> = {
  primeval:
    'bg-[image:conic-gradient(from_calc(var(--heatmap-ring-angle,0)*1deg),color-mix(in_srgb,var(--color-rarity-primordial-start)_45%,transparent)_0deg,color-mix(in_srgb,var(--color-rarity-primordial-end)_45%,transparent)_220deg,var(--color-rarity-primordial-start)_290deg,var(--color-rarity-primordial-end)_345deg,color-mix(in_srgb,var(--color-rarity-primordial-start)_45%,transparent)_360deg)]',
  mythic:
    'bg-[image:conic-gradient(from_calc(var(--heatmap-ring-angle,0)*1deg),color-mix(in_srgb,var(--color-rarity-mythic-start)_45%,transparent)_0deg,color-mix(in_srgb,var(--color-rarity-mythic-end)_45%,transparent)_220deg,var(--color-rarity-mythic-start)_290deg,var(--color-rarity-mythic-end)_345deg,color-mix(in_srgb,var(--color-rarity-mythic-start)_45%,transparent)_360deg)]'
}

const RING_LABELS = { primeval: '태초', mythic: '신화' } as const

const numberFormat = new Intl.NumberFormat('ko-KR')

type CellPayload = Readonly<{ date: string }>
type CellTooltip = ReturnType<typeof Tooltip.createHandle<CellPayload>>

// 칸 사이 4px 간격을 지나는 동안 닫히지 않을 만큼만 기다리고, 칸 영역을 벗어나면 곧 닫는다.
const CELL_TOOLTIP_CLOSE_DELAY = 100

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
    <div aria-hidden="true" className="ms-auto flex items-center gap-1 num text-2xs text-fg-subtle">
      0
      {LEVEL_FILLS.map((fill, index) => (
        <span key={index} className={`size-3 rounded-control ${KIND_TONES[kind]} ${fill}`} />
      ))}
      {numberFormat.format(top)}
      {unitOf(kind)} 이상
    </div>
  )
}

// 서약 뱃지까지 붙는 시즌만 좁은 폭에서 뱃지를 줄바꿈하고, 옛 시즌 뱃지 줄은 그대로 둔다.
function RarityTags({
  counts,
  prefix,
  wrap
}: {
  counts: RarityCounts
  prefix: string
  wrap: boolean
}): React.JSX.Element | null {
  const { legendary, epic, primeval, mythic = 0 } = counts

  if (rarityTotal(counts) === 0) {
    return null
  }

  return (
    <span className={wrap ? 'flex flex-wrap gap-2' : 'flex gap-2'}>
      {legendary > 0 && (
        <span className={`${TAG} ${raritySolidClasses.legendary}`}>
          {prefix}레전더리 {numberFormat.format(legendary)}
        </span>
      )}
      {epic > 0 && (
        <span className={`${TAG} ${raritySolidClasses.epic}`}>
          {prefix}에픽 {numberFormat.format(epic)}
        </span>
      )}
      {primeval > 0 && (
        <span className={`${TAG} ${raritySolidClasses.primordial}`}>
          <span className={rarityTextClasses.primordial}>
            {prefix}태초 {numberFormat.format(primeval)}
          </span>
        </span>
      )}
      {mythic > 0 && (
        <span className={`${TAG} ${raritySolidClasses.mythic}`}>
          <span className={rarityTextClasses.mythic}>
            {prefix}신화 {numberFormat.format(mythic)}
          </span>
        </span>
      )}
    </span>
  )
}

function ItemTags({
  summary,
  hasOaths
}: {
  summary: ActivitySummary
  hasOaths: boolean
}): React.JSX.Element | null {
  if (!hasOaths) {
    return <RarityTags counts={summary.items} prefix="" wrap={false} />
  }

  const hasDivider = rarityTotal(summary.items) > 0 && rarityTotal(summary.oaths) > 0

  return (
    <span className="flex flex-wrap gap-2">
      <RarityTags counts={summary.items} prefix="" wrap />
      {hasDivider && <span aria-hidden="true" className="w-px self-stretch bg-line" />}
      <RarityTags counts={summary.oaths} prefix="서약 " wrap />
    </span>
  )
}

function Ring({ highlight }: { highlight: RingHighlight }): React.JSX.Element {
  return (
    <>
      <i aria-hidden="true" className={`${RING} ${RING_FRAMES.glow} ${RING_FILLS[highlight]}`} />
      <i aria-hidden="true" className={`${RING} ${RING_FRAMES.frame} ${RING_FILLS[highlight]}`} />
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
    return <span aria-hidden="true" className={`${CELL} border border-dashed border-line`} />
  }

  const active = day !== undefined && dayCount(day, kind) > 0
  const todayOutline = cell.today ? ' outline-1 outline-offset-1 outline-fg' : ''
  const activeHover = active ? ' cursor-default hover:shadow-[0_0_0_2px_var(--color-fg)]' : ''
  const props = {
    role: 'img',
    'aria-label': cellLabel(kind, cell.date, day),
    className: `${CELL} ${KIND_TONES[kind]} ${LEVEL_FILLS[level]}${todayOutline}${activeHover}`
  }

  if (day === undefined || !active) {
    return <span {...props} />
  }

  const highlight = ringHighlight(day, kind)

  return (
    <Tooltip.Trigger
      handle={tooltip}
      payload={{ date: cell.date }}
      delay={0}
      closeDelay={CELL_TOOLTIP_CLOSE_DELAY}
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
  useHeatmapRingSpin(ref, hasRing)

  return (
    <div
      ref={ref}
      className={`grid w-max grid-flow-col auto-cols-[12px] items-center gap-1 ${ROWS}`}
    >
      {weeks.flatMap((week, weekIndex) => [
        <span key={`month-${weekIndex}`} aria-hidden="true" className={LABEL}>
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

function CellTooltipPopup({
  date,
  kind,
  seasonDays,
  hasOaths
}: {
  date: string
  kind: ActivityKind
  seasonDays: AdventureActivitySeasonDaysResult
  hasOaths: boolean
}): React.JSX.Element {
  const popupRef = useHeatmapTooltipSlide(date)

  return (
    <Tooltip.Popup ref={popupRef} side="top" sideOffset={8}>
      <ActivityDayDetail date={date} kind={kind} seasonDays={seasonDays} hasOaths={hasOaths} />
    </Tooltip.Popup>
  )
}

function DayLabels(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 grid-cols-[24px] items-center gap-y-1 py-1 ${ROWS}`}
    >
      <span />
      {ROW_LABELS.map((label, index) => (
        <span key={index} className={LABEL}>
          {label}
        </span>
      ))}
    </div>
  )
}

// GitHub처럼 가장 최근 주가 보이게 한다. 받아 둔 시즌으로 돌아가면 패널을 새로 그리지 않으므로 시즌마다 맞춘다.
function useScrollToLatest(ref: RefObject<HTMLElement | null>, seasonId: number): void {
  useLayoutEffect(() => {
    const element = ref.current
    if (element == null) {
      return
    }

    element.scrollLeft = element.scrollWidth
  }, [ref, seasonId])
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
  const seasonDays = useAdventureActivitySeasonDays(adventureName, season.id)
  const hasOaths = seasonHasOaths(season.id)
  const weeks = buildHeatmapWeeks(season, now)
  const days = new Map(activity.days.map((day) => [day.date, day]))
  const thresholds = levelThresholds(activity.days.map((day) => dayCount(day, kind)))
  const scroller = useRef<HTMLDivElement>(null)
  useScrollToLatest(scroller, season.id)
  useHeatmapWheelScroll(scroller)

  return (
    <>
      <div className="flex min-h-[18px] items-center justify-between gap-4 px-4 pt-6 max-sm:pt-4">
        {kind === 'item' && <ItemTags summary={activity.summary} hasOaths={hasOaths} />}
        <Legend kind={kind} thresholds={thresholds} />
      </div>
      <div className="flex px-4 pt-3 pb-6 max-sm:pb-4">
        <DayLabels />
        {/* 테두리 빛(칸 밖 4px)과 마우스 테두리가 스크롤 영역에 잘리지 않게 둔다. */}
        <div ref={scroller} className="min-w-0 overflow-x-auto py-1 pr-3 pl-1">
          <HeatmapGrid
            kind={kind}
            weeks={weeks}
            days={days}
            thresholds={thresholds}
            tooltip={tooltip}
          />
        </div>
      </div>
      <Tooltip.Root handle={tooltip} disableHoverablePopup>
        {({ payload }) =>
          payload !== undefined && (
            <CellTooltipPopup
              date={payload.date}
              kind={kind}
              seasonDays={seasonDays}
              hasOaths={hasOaths}
            />
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
  const loadedSeasonId = result.status === 'success' ? result.value.season?.id : undefined
  const seasonId = season ?? loadedSeasonId
  const hasLegion = seasonHasLegion(seasonId)
  if (!hasLegion && kind === 'legion') {
    setKind('all')
  }

  if (result.status === 'error') {
    return null
  }

  const activity = result.status === 'success' && !result.previous ? result.value : undefined
  if (activity === undefined) {
    return <div aria-hidden="true" className={`${BOX} min-h-[280px]`} />
  }

  const range = activity.season
  if (range === null) {
    return null
  }
  const kinds = hasLegion ? KINDS : KINDS.filter(({ kind: entryKind }) => entryKind !== 'legion')

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
      className={BOX}
    >
      {kinds.map(({ kind: panelKind }) => (
        <Tabs.Panel key={panelKind} value={panelKind} className="min-w-0 outline-none">
          <HeatmapPanel
            adventureName={adventureName}
            activity={activity}
            season={range}
            kind={panelKind}
            now={now}
          />
        </Tabs.Panel>
      ))}
      <Tabs.List
        aria-label="활동 종류"
        className="relative flex flex-col border-l border-line py-6 xl:absolute xl:top-0 xl:left-full xl:ml-4 xl:w-[120px] xl:py-0 max-sm:order-first max-sm:flex-row max-sm:border-b max-sm:border-l-0 max-sm:px-1 max-sm:py-0"
      >
        {kinds.map(({ kind: tabKind, label }) => (
          <Tabs.Tab
            key={tabKind}
            value={tabKind}
            className="block w-full cursor-pointer py-2 px-4 text-left max-sm:w-auto max-sm:px-3 max-sm:py-3 text-sm font-medium text-fg-muted focus-ring-inset hover:text-fg data-active:font-semibold data-active:text-fg"
          >
            {label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute -left-px top-[calc(var(--active-tab-top)+4px)] h-[calc(var(--active-tab-height)-8px)] w-[2px] bg-signal transition-[top,height] max-sm:top-auto max-sm:-bottom-px max-sm:left-(--active-tab-left) max-sm:h-[2px] max-sm:w-(--active-tab-width) max-sm:transition-[left,width]" />
      </Tabs.List>
    </Tabs.Root>
  )
}
