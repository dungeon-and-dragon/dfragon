import type { ReactNode } from 'react'
import type {
  ActivityDayEnhancement,
  ActivityDayItem,
  AdventureActivityDay
} from '#entities/adventure-guild'
import type { AdventureActivitySeasonDaysResult } from './api/useAdventureActivity'
import type { ActivityKind } from './activity-heatmap'
import { formatClearCount } from './clear-count'
import { type DayItemRow, dayItemGroups } from './day-item-rows'
import { enhancementKindClasses, rarityTextOfName } from '#entities/character'
import { formatActivityDate, formatSeoulTime } from './season-format'

const MAX_ENHANCEMENT_ROWS = 8

const numberFormat = new Intl.NumberFormat('ko-KR')

const ROW = 'flex py-1 text-xs'
const SPREAD_ROW = `${ROW} justify-between gap-4`
const TEXT = 'min-w-0 overflow-hidden text-ellipsis'
const COUNT = 'num text-fg-muted'

type NameCount = AdventureActivityDay['raids'][number]

function Group({ title }: { title: string }): React.JSX.Element {
  return <div className="label flex justify-between gap-4 pt-2 pb-1">{title}</div>
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
      <span className="w-[36px] shrink-0 num text-fg-subtle">{formatSeoulTime(at)}</span>
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
      <span className={`${TEXT} ${rarityTextOfName(row.rarity) ?? ''}`}>{row.rarity}</span>
      <span className={COUNT}>{numberFormat.format(row.count)}개</span>
    </div>
  )
}

function ItemGroup({
  title,
  rows
}: {
  title: string
  rows: readonly DayItemRow[]
}): React.JSX.Element | null {
  if (rows.length === 0) {
    return null
  }

  return (
    <>
      <Group title={title} />
      {rows.map((row, index) => (
        <ItemRow key={index} row={row} />
      ))}
    </>
  )
}

function ItemGroups({
  day,
  hasOaths
}: {
  day: AdventureActivityDay
  hasOaths: boolean
}): React.JSX.Element {
  const groups = dayItemGroups(day.items, day.oaths)

  return (
    <>
      <ItemGroup title={hasOaths ? '장비' : '아이템'} rows={groups.items} />
      <ItemGroup title="서약" rows={groups.oaths} />
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
  return <span className={rarityTextOfName(rarity)}>{name}</span>
}

function EnhancementResult({ kind, target, success }: ActivityDayEnhancement): React.JSX.Element {
  return (
    <>
      <b className={`num font-semibold ${enhancementKindClasses[kind]}`}>+{target}</b>{' '}
      <span className={success ? 'text-fg-success' : 'text-fg-danger'}>
        {success ? '성공' : '실패'}
      </span>
    </>
  )
}

function DayRecords({
  day,
  kind,
  hasOaths
}: {
  day: AdventureActivityDay | undefined
  kind: ActivityKind
  hasOaths: boolean
}): React.JSX.Element | null {
  if (day === undefined) {
    return null
  }

  return (
    <>
      {(kind === 'all' || kind === 'raid') && <ClearGroup title="레이드" counts={day.raids} />}
      {(kind === 'all' || kind === 'legion') && <ClearGroup title="레기온" counts={day.legions} />}
      {(kind === 'all' || kind === 'item') && <ItemGroups day={day} hasOaths={hasOaths} />}
      {(kind === 'all' || kind === 'enhance') && (
        <EnhancementGroup enhancements={day.enhancements} />
      )}
    </>
  )
}

export function ActivityDayDetail({
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
  return (
    <div className="flex w-[256px] flex-col text-fg">
      <div className="mb-1 flex justify-between gap-4 border-b border-line pb-2 text-xs text-fg-muted">
        <span className="text-fg">{formatActivityDate(date)}</span>
      </div>
      {seasonDays.status === 'loading' && (
        <span aria-hidden="true" className="skeleton my-1 h-12" />
      )}
      {seasonDays.status === 'error' && (
        <p role="alert" className="state state-error">
          {seasonDays.message}
        </p>
      )}
      {seasonDays.status === 'success' && (
        <DayRecords
          day={seasonDays.value.find((day) => day.date === date)}
          kind={kind}
          hasOaths={hasOaths}
        />
      )}
    </div>
  )
}
