import { Button, ProgressCircle } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { type ReactNode, useCallback } from 'react'
import type {
  TimelineAcquisition,
  TimelineClear,
  TimelineClearCount,
  TimelineEnhancement
} from '#core/character/character-timeline'
import type { TimelinePages } from '../../hooks/useTimelinePages'
import {
  acquisitionRoute,
  CLEAR_KIND_LABELS,
  ENHANCEMENT_KIND_LABELS,
  formatEnhancementValue
} from './timeline-format'
import { RelativeTime } from '../../../../components/RelativeTime'
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

// 목록 끝의 빈 줄이 화면에 들어오면 다음 묶음을 받는다. 받은 뒤 다시 그린 빈 줄이 아직 화면 안이면 이어서 받는다.
export function TimelineMore({
  state,
  loadMore
}: Pick<TimelinePages<unknown>, 'state' | 'loadMore'>): React.JSX.Element | null {
  const watchEnd = useCallback(
    (element: HTMLDivElement) => {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore()
        }
      })
      observer.observe(element)

      return () => observer.disconnect()
    },
    [loadMore]
  )
  switch (state.status) {
    case 'end':
      return null
    case 'idle':
      return <div ref={watchEnd} aria-hidden="true" {...stylex.props(styles.more)} />
    case 'loading':
      return (
        <div aria-busy="true" {...stylex.props(styles.more)}>
          <ProgressCircle size="24" tone="neutral" aria-hidden="true" />
          <span role="status">기록을 더 받는 중입니다.</span>
        </div>
      )
    case 'error':
      return (
        <div {...stylex.props(styles.more)}>
          <p role="alert" {...stylex.props(styles.moreError)}>
            {state.message}
          </p>
          <Button variant="secondary" size="sm" onClick={loadMore}>
            다시 시도
          </Button>
        </div>
      )
  }
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
            <RelativeTime at={clear.occurredAt} style={styles.clearTime} />
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
  enhancements,
  more
}: {
  enhancements: readonly TimelineEnhancement[]
  more?: ReactNode
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
                <RelativeTime at={enhancement.occurredAt} />
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
      {more}
    </TimelineGroup>
  )
}

export function Acquisitions({
  acquisitions,
  more
}: {
  acquisitions: readonly TimelineAcquisition[]
  more?: ReactNode
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
                <RelativeTime at={acquisition.occurredAt} />
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
      {more}
    </TimelineGroup>
  )
}
