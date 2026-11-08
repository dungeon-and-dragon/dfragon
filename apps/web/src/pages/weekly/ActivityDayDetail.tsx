import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import type {
  ActivityDayEnhancement,
  ActivityDayItem,
  AdventureActivityDay
} from '#core/adventure-guild/adventure-activity'
import { useAdventureActivityDay } from '../../hooks/useAdventureActivity'
import type { ActivityKind } from './activity-heatmap'
import { styles } from './ActivityDayDetail.style'
import { formatClearCount } from './clear-count'
import { type DayItemRow, dayItemRows } from './day-item-rows'
import { formatActivityDate, formatSeoulTime } from './season-format'

const MAX_ENHANCEMENT_ROWS = 8

const numberFormat = new Intl.NumberFormat('ko-KR')

const RARITY_STYLES: Readonly<Record<string, stylex.StyleXStyles>> = {
  레전더리: styles.legendary,
  에픽: styles.epic,
  태초: styles.primordial,
  신화: styles.mythic
}

const ENHANCEMENT_STYLES: Readonly<Record<ActivityDayEnhancement['kind'], stylex.StyleXStyles>> = {
  reinforce: styles.reinforce,
  amplify: styles.amplify,
  refine: styles.refine
}

type NameCount = AdventureActivityDay['raids'][number]

function Group({ title }: { title: string }): React.JSX.Element {
  return <div {...stylex.props(styles.group)}>{title}</div>
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
        <div key={clear.name} {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.text)}>{clear.name}</span>
          <span {...stylex.props(styles.number, styles.muted)}>{formatClearCount(clear)}</span>
        </div>
      ))}
    </>
  )
}

function TimelineRow({ at, children }: { at: string; children: ReactNode }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.row, styles.timelineRow)}>
      <span {...stylex.props(styles.number, styles.time)}>{formatSeoulTime(at)}</span>
      <span {...stylex.props(styles.text)}>{children}</span>
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
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.text, RARITY_STYLES[row.rarity])}>{row.rarity}</span>
      <span {...stylex.props(styles.number, styles.muted)}>{numberFormat.format(row.count)}개</span>
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
        <div {...stylex.props(styles.row, styles.muted)}>외 {numberFormat.format(rest)}회</div>
      )}
    </>
  )
}

function ItemName({ name, rarity }: ActivityDayItem): React.JSX.Element {
  return <span {...stylex.props(RARITY_STYLES[rarity])}>{name}</span>
}

function EnhancementResult({ kind, target, success }: ActivityDayEnhancement): React.JSX.Element {
  return (
    <>
      <b {...stylex.props(styles.target, ENHANCEMENT_STYLES[kind])}>+{target}</b>{' '}
      <span {...stylex.props(success ? styles.success : styles.failure)}>
        {success ? '성공' : '실패'}
      </span>
    </>
  )
}

function DayRecords({
  day,
  kind
}: {
  day: AdventureActivityDay
  kind: ActivityKind
}): React.JSX.Element {
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
  adventureName,
  date,
  kind
}: {
  adventureName: string
  date: string
  kind: ActivityKind
}): React.JSX.Element {
  const result = useAdventureActivityDay(adventureName, date)

  return (
    <div {...stylex.props(styles.detail)}>
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.date)}>{formatActivityDate(date)}</span>
      </div>
      {result.status === 'loading' && (
        <>
          <span role="status" {...stylex.props(shapes.srOnly)}>
            하루 활동을 받는 중입니다.
          </span>
          <span aria-hidden="true" {...stylex.props(styles.bone)} />
        </>
      )}
      {result.status === 'error' && (
        <span role="alert" {...stylex.props(styles.row, styles.failure)}>
          {result.message}
        </span>
      )}
      {result.status === 'success' && <DayRecords day={result.value} kind={kind} />}
    </div>
  )
}
