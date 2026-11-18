import type { ReactNode } from 'react'
import type {
  ActivityDayEnhancement,
  ActivityDayItem,
  AdventureActivityDay
} from '#core/adventure-guild/adventure-activity'
import type { AdventureActivitySeasonDaysResult } from './hooks/useAdventureActivity'
import type { ActivityKind } from './activity-heatmap'
import { formatClearCount } from './clear-count'
import { type DayItemRow, dayItemRows } from './day-item-rows'
import { formatActivityDate, formatSeoulTime } from './season-format'

const MAX_ENHANCEMENT_ROWS = 8

const numberFormat = new Intl.NumberFormat('ko-KR')

const GRADIENT_TEXT = 'bg-clip-text text-transparent'

const RARITY_TONES: Readonly<Record<string, string>> = {
  레전더리: 'text-rarity-legendary',
  에픽: 'text-rarity-epic',
  태초: `bg-(image:--gradient-rarity-primordial) ${GRADIENT_TEXT}`,
  신화: `bg-(image:--gradient-rarity-mythic) ${GRADIENT_TEXT}`
}

const ENHANCEMENT_TONES: Readonly<Record<ActivityDayEnhancement['kind'], string>> = {
  reinforce: 'text-game-enhance',
  amplify: 'text-game-amplify',
  refine: 'text-game-refine'
}

const ROW = 'flex py-1 text-xs'
const SPREAD_ROW = `${ROW} justify-between gap-4`
const TEXT = 'min-w-0 overflow-hidden text-ellipsis'
const COUNT = 'font-mono tabular-nums text-fg-muted'

type NameCount = AdventureActivityDay['raids'][number]

function Group({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-4 pt-2 pb-1 text-xs font-medium text-fg-subtle">
      {title}
    </div>
  )
}

function ClearGroup({
  title,
  counts
}: {
  title: string
  counts: readonly NameCount[]
}): React.JSX.Element | null {
  if (counts.length === 0) {
    return null
  }

  return (
    <>
      <Group title={title} />
      {counts.map((clear) => (
        <div key={clear.name} className={SPREAD_ROW}>
          <span className={TEXT}>{clear.name}</span>
          <span className={COUNT}>{formatClearCount(clear)}</span>
        </div>
      ))}
    </>
  )
}

function TimelineRow({ at, children }: { at: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className={`${ROW} justify-start gap-2`}>
      <span className="w-9 shrink-0 font-mono tabular-nums text-fg-subtle">
        {formatSeoulTime(at)}
      </span>
      <span className={TEXT}>{children}</span>
    </div>
  )
}

function ItemRow({ row }: { row: DayItemRow }): React.JSX.Element {
  if (row.kind === 'item') {
    return (
      <TimelineRow at={row.item.at}>
        <ItemName {...row.item} />
      </TimelineRow>
    )
  }

  return (
    <div className={SPREAD_ROW}>
      <span className={`${TEXT} ${RARITY_TONES[row.rarity] ?? ''}`}>{row.rarity}</span>
      <span className={COUNT}>{numberFormat.format(row.count)}개</span>
    </div>
  )
}

function ItemGroup({ items }: { items: readonly ActivityDayItem[] }): React.JSX.Element | null {
  if (items.length === 0) {
    return null
  }

  return (
    <>
      <Group title="아이템" />
      {dayItemRows(items).map((row, index) => (
        <ItemRow key={index} row={row} />
      ))}
    </>
  )
}

function EnhancementGroup({
  enhancements
}: {
  enhancements: readonly ActivityDayEnhancement[]
}): React.JSX.Element | null {
  if (enhancements.length === 0) {
    return null
  }

  const rest = enhancements.length - MAX_ENHANCEMENT_ROWS

  return (
    <>
      <Group title="강화" />
      {enhancements.slice(0, MAX_ENHANCEMENT_ROWS).map((enhancement, index) => (
        <TimelineRow key={index} at={enhancement.at}>
          <EnhancementResult {...enhancement} />
        </TimelineRow>
      ))}
      {rest > 0 && (
        <div className={`${SPREAD_ROW} text-fg-muted`}>외 {numberFormat.format(rest)}회</div>
      )}
    </>
  )
}

function ItemName({ name, rarity }: ActivityDayItem): React.JSX.Element {
  return <span className={RARITY_TONES[rarity]}>{name}</span>
}

function EnhancementResult({ kind, target, success }: ActivityDayEnhancement): React.JSX.Element {
  return (
    <>
      <b className={`font-mono font-semibold tabular-nums ${ENHANCEMENT_TONES[kind]}`}>+{target}</b>{' '}
      <span className={success ? 'text-fg-success' : 'text-fg-danger'}>
        {success ? '성공' : '실패'}
      </span>
    </>
  )
}

function DayRecords({
  day,
  kind
}: {
  day: AdventureActivityDay | undefined
  kind: ActivityKind
}): React.JSX.Element | null {
  if (day === undefined) {
    return null
  }

  return (
    <>
      {(kind === 'all' || kind === 'raid') && <ClearGroup title="레이드" counts={day.raids} />}
      {(kind === 'all' || kind === 'legion') && <ClearGroup title="레기온" counts={day.legions} />}
      {(kind === 'all' || kind === 'item') && <ItemGroup items={day.items} />}
      {(kind === 'all' || kind === 'enhance') && (
        <EnhancementGroup enhancements={day.enhancements} />
      )}
    </>
  )
}

export function ActivityDayDetail({
  date,
  kind,
  seasonDays
}: {
  date: string
  kind: ActivityKind
  seasonDays: AdventureActivitySeasonDaysResult
}): React.JSX.Element {
  return (
    <div className="flex w-64 flex-col text-fg">
      <div className="mb-1 flex justify-between gap-4 border-b border-line pb-2 text-xs text-fg-muted">
        <span className="text-fg">{formatActivityDate(date)}</span>
      </div>
      {seasonDays.status === 'loading' && (
        <>
          <span role="status" className="sr-only">
            하루 활동을 받는 중입니다.
          </span>
          <span aria-hidden="true" className="my-1 block h-12 rounded-control bg-control" />
        </>
      )}
      {seasonDays.status === 'error' && (
        <span role="alert" className={`${SPREAD_ROW} text-fg-danger`}>
          {seasonDays.message}
        </span>
      )}
      {seasonDays.status === 'success' && (
        <DayRecords day={seasonDays.value.find((day) => day.date === date)} kind={kind} />
      )}
    </div>
  )
}
