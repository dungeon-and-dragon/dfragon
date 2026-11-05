import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import type {
  TimelineAcquisition,
  TimelineClear,
  TimelineClearCount,
  TimelineEnhancement
} from '@dfragon/client-core/shared/search/character-timeline'
import {
  acquisitionRoute,
  CLEAR_KIND_LABELS,
  ENHANCEMENT_KIND_LABELS,
  formatEnhancementValue,
  formatTimelineTime
} from './timeline-format'
import { rarityStyles, styles } from './TimelineTab.style'

const TIME_COLUMN_WIDTH = 112

const RARITY_STYLES: Readonly<Record<string, stylex.StyleXStyles>> = {
  커먼: rarityStyles.common,
  언커먼: rarityStyles.uncommon,
  레어: rarityStyles.rare,
  유니크: rarityStyles.unique,
  에픽: rarityStyles.epic,
  레전더리: rarityStyles.legendary,
  크로니클: rarityStyles.chronicle,
  태초: rarityStyles.primordial,
  신화: rarityStyles.mythic
}

function TimelineGroup({
  title,
  count,
  note,
  emptyText,
  children
}: {
  title: string
  count: number
  note?: string
  emptyText: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-label={title} {...stylex.props(styles.group)}>
      <h2 {...stylex.props(styles.groupHeader)}>
        <span {...stylex.props(styles.groupTitle)}>{title}</span>
        <span {...stylex.props(styles.groupCount)}>{count}</span>
        {note !== undefined && <span>{note}</span>}
      </h2>
      {count === 0 ? <p {...stylex.props(styles.empty)}>{emptyText}</p> : children}
    </section>
  )
}

function ItemName({
  itemName,
  itemRarity
}: Pick<TimelineEnhancement, 'itemName' | 'itemRarity'>): React.JSX.Element {
  if (itemName == null) {
    return <span {...stylex.props(styles.missing)}>-</span>
  }

  return <span {...stylex.props(itemRarity != null && RARITY_STYLES[itemRarity])}>{itemName}</span>
}

export function WeeklyClears({ clears }: { clears: readonly TimelineClear[] }): React.JSX.Element {
  return (
    <TimelineGroup
      title="이번 주 클리어"
      count={clears.length}
      emptyText="이번 주 클리어 기록이 없습니다."
    >
      <ul {...stylex.props(styles.list)}>
        {clears.map((clear, index) => (
          <li key={`${clear.occurredAt}-${index}`} {...stylex.props(styles.clear)}>
            <span {...stylex.props(styles.badge)}>{CLEAR_KIND_LABELS[clear.kind]}</span>
            <span {...stylex.props(styles.clearName)}>{clear.name}</span>
            {clear.hard && <span {...stylex.props(styles.badge)}>하드</span>}
            {clear.modeName != null && (
              <span {...stylex.props(styles.clearMode)}>{clear.modeName}</span>
            )}
            <time dateTime={clear.occurredAt} {...stylex.props(styles.clearTime)}>
              {formatTimelineTime(clear.occurredAt)}
            </time>
          </li>
        ))}
      </ul>
    </TimelineGroup>
  )
}

export function SeasonClears({
  counts
}: {
  counts: readonly TimelineClearCount[]
}): React.JSX.Element {
  return (
    <TimelineGroup
      title="시즌 클리어 횟수"
      count={counts.length}
      emptyText="이번 시즌 클리어 기록이 없습니다."
    >
      <ul {...stylex.props(styles.counts)}>
        {counts.map((count) => (
          <li key={`${count.kind}-${count.name}-${count.hard}`} {...stylex.props(styles.countChip)}>
            <span {...stylex.props(styles.badge, styles.badgeInChip)}>
              {CLEAR_KIND_LABELS[count.kind]}
            </span>
            <span>{count.name}</span>
            {count.hard && <span {...stylex.props(styles.badge, styles.badgeInChip)}>하드</span>}
            <span {...stylex.props(styles.countValue)}>{count.count}</span>
          </li>
        ))}
      </ul>
    </TimelineGroup>
  )
}

function HeaderCell({
  children,
  first = false,
  last = false
}: {
  children: ReactNode
  first?: boolean
  last?: boolean
}): React.JSX.Element {
  return (
    <th scope="col" {...stylex.props(styles.header, first && styles.first, last && styles.last)}>
      {children}
    </th>
  )
}

export function Enhancements({
  enhancements
}: {
  enhancements: readonly TimelineEnhancement[]
}): React.JSX.Element {
  return (
    <TimelineGroup
      title="강화, 증폭, 재련"
      count={enhancements.length}
      emptyText="강화, 증폭, 재련 기록이 없습니다."
    >
      <table {...stylex.props(styles.table)}>
        <colgroup>
          <col {...stylex.props(styles.width(TIME_COLUMN_WIDTH))} />
          <col {...stylex.props(styles.width(56))} />
          <col />
          <col {...stylex.props(styles.width(80))} />
          <col {...stylex.props(styles.width(96))} />
        </colgroup>
        <thead>
          <tr>
            <HeaderCell first>일시</HeaderCell>
            <HeaderCell>종류</HeaderCell>
            <HeaderCell>장비</HeaderCell>
            <HeaderCell>수치</HeaderCell>
            <HeaderCell last>결과</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {enhancements.map((enhancement, index) => (
            <tr key={`${enhancement.occurredAt}-${index}`}>
              <td {...stylex.props(styles.cell, styles.first, styles.time)}>
                <time dateTime={enhancement.occurredAt}>
                  {formatTimelineTime(enhancement.occurredAt)}
                </time>
              </td>
              <td {...stylex.props(styles.cell, styles[enhancement.kind])}>
                {ENHANCEMENT_KIND_LABELS[enhancement.kind]}
              </td>
              <td {...stylex.props(styles.cell)}>
                <ItemName itemName={enhancement.itemName} itemRarity={enhancement.itemRarity} />
              </td>
              <td {...stylex.props(styles.cell, styles.number)}>
                {formatEnhancementValue(enhancement)}
              </td>
              <td {...stylex.props(styles.cell, styles.last)}>
                <span {...stylex.props(styles.result)}>
                  <span {...stylex.props(enhancement.result ? styles.success : styles.failure)}>
                    {enhancement.result ? '성공' : '실패'}
                  </span>
                  {enhancement.safe === true && <span {...stylex.props(styles.badge)}>안전</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TimelineGroup>
  )
}

export function Acquisitions({
  acquisitions
}: {
  acquisitions: readonly TimelineAcquisition[]
}): React.JSX.Element {
  return (
    <TimelineGroup
      title="획득"
      count={acquisitions.length}
      note="에픽, 태초"
      emptyText="에픽, 태초 획득 기록이 없습니다."
    >
      <table {...stylex.props(styles.table)}>
        <colgroup>
          <col {...stylex.props(styles.width(TIME_COLUMN_WIDTH))} />
          <col />
          <col {...stylex.props(styles.width(140))} />
        </colgroup>
        <thead>
          <tr>
            <HeaderCell first>일시</HeaderCell>
            <HeaderCell>장비</HeaderCell>
            <HeaderCell last>경로</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {acquisitions.map((acquisition, index) => (
            <tr key={`${acquisition.occurredAt}-${index}`}>
              <td {...stylex.props(styles.cell, styles.first, styles.time)}>
                <time dateTime={acquisition.occurredAt}>
                  {formatTimelineTime(acquisition.occurredAt)}
                </time>
              </td>
              <td {...stylex.props(styles.cell)}>
                <ItemName itemName={acquisition.itemName} itemRarity={acquisition.itemRarity} />
              </td>
              <td {...stylex.props(styles.cell, styles.last, styles.muted)}>
                {acquisitionRoute(acquisition.name)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TimelineGroup>
  )
}
