import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import type {
  ActivityDayEnhancement,
  ActivityDayItem,
  AdventureActivityDay
} from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { useAdventureActivityDay } from '../../hooks/useAdventureActivity'
import { styles } from './ActivityDayDetail.style'
import { formatActivityDate, formatSeoulTime } from './season-format'

const MAX_TIMELINE_ROWS = 8

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

function Group({ title, value }: { title: string; value: string }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.group)}>
      <span>{title}</span>
      <span {...stylex.props(styles.number)}>{value}</span>
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

  const total = counts.reduce((sum, { count }) => sum + count, 0)

  return (
    <>
      <Group title={title} value={`${numberFormat.format(total)}회`} />
      {counts.map(({ name, count }) => (
        <div key={name} {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.text)}>{name}</span>
          <span {...stylex.props(styles.number, styles.muted)}>{numberFormat.format(count)}회</span>
        </div>
      ))}
    </>
  )
}

function TimelineGroup<Entry extends { at: string }>({
  title,
  unit,
  entries,
  render
}: {
  title: string
  unit: string
  entries: readonly Entry[]
  render: (entry: Entry) => ReactNode
}): React.JSX.Element | null {
  if (entries.length === 0) {
    return null
  }

  const rest = entries.length - MAX_TIMELINE_ROWS

  return (
    <>
      <Group title={title} value={`${numberFormat.format(entries.length)}${unit}`} />
      {entries.slice(0, MAX_TIMELINE_ROWS).map((entry, index) => (
        <div key={index} {...stylex.props(styles.row, styles.timelineRow)}>
          <span {...stylex.props(styles.number, styles.time)}>{formatSeoulTime(entry.at)}</span>
          <span {...stylex.props(styles.text)}>{render(entry)}</span>
        </div>
      ))}
      {rest > 0 && (
        <div {...stylex.props(styles.row, styles.muted)}>
          외 {numberFormat.format(rest)}
          {unit}
        </div>
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

function renderItem(item: ActivityDayItem): ReactNode {
  return <ItemName {...item} />
}

function renderEnhancement(enhancement: ActivityDayEnhancement): ReactNode {
  return <EnhancementResult {...enhancement} />
}

function DayRecords({ day }: { day: AdventureActivityDay }): React.JSX.Element {
  return (
    <>
      <ClearGroup title="레이드" counts={day.raids} />
      <ClearGroup title="레기온" counts={day.legions} />
      <TimelineGroup title="아이템" unit="개" entries={day.items} render={renderItem} />
      <TimelineGroup title="강화" unit="회" entries={day.enhancements} render={renderEnhancement} />
    </>
  )
}

export function ActivityDayDetail({
  adventureName,
  date,
  total
}: {
  adventureName: string
  date: string
  total: number
}): React.JSX.Element {
  const result = useAdventureActivityDay(adventureName, date)

  return (
    <div {...stylex.props(styles.detail)}>
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.date)}>{formatActivityDate(date)}</span>
        <span {...stylex.props(styles.number)}>{numberFormat.format(total)}회</span>
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
      {result.status === 'success' && <DayRecords day={result.value} />}
    </div>
  )
}
