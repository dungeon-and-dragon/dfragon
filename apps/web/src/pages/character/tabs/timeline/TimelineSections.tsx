import { Button, ProgressCircle } from '@dfragon/ui'
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
import { tableClasses } from '../../../../components/table/table-classes'
import { raritySolidClasses } from '../equipment/item-classes'

const RARITY_TONES: Readonly<Record<string, string>> = {
  커먼: raritySolidClasses.common,
  언커먼: raritySolidClasses.uncommon,
  레어: raritySolidClasses.rare,
  유니크: raritySolidClasses.unique,
  에픽: raritySolidClasses.epic,
  레전더리: raritySolidClasses.legendary,
  크로니클: raritySolidClasses.chronicle,
  태초: raritySolidClasses.primordial,
  신화: raritySolidClasses.mythic
}

const ENHANCEMENT_KIND_TONES: Readonly<Record<TimelineEnhancement['kind'], string>> = {
  reinforce: 'text-game-enhance',
  amplify: 'text-game-amplify',
  refine: 'text-game-refine'
}

const BADGE =
  'inline-flex h-5 shrink-0 items-center rounded-badge px-1.5 text-xs font-medium whitespace-nowrap text-fg-muted'
const TABLE = 'w-full table-fixed border-collapse'
const CELL = 'h-row truncate border-t border-line px-3 first:pl-4 last:pr-4'
const TIME_COLUMN = 'w-28'
const MORE =
  'flex min-h-12 items-center justify-center gap-2 border-t border-line px-4 text-fg-muted'

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
    <section
      aria-label={title}
      className="min-w-0 overflow-hidden rounded-panel border border-line"
    >
      <h2 className="m-0 box-border flex min-h-11 items-center gap-2 border-b border-line px-4 text-xs font-medium whitespace-nowrap text-fg-subtle">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="font-mono tabular-nums">{count}</span>
        {note !== undefined && <span>{note}</span>}
      </h2>
      {count === 0 ? <p className="m-0 px-4 py-3 text-fg-subtle">{emptyText}</p> : children}
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
      return <div ref={watchEnd} aria-hidden="true" className={MORE} />
    case 'loading':
      return (
        <div aria-busy="true" className={MORE}>
          <ProgressCircle size="24" tone="neutral" aria-hidden="true" />
          <span role="status">기록을 더 받는 중입니다.</span>
        </div>
      )
    case 'error':
      return (
        <div className={MORE}>
          <p role="alert" className="m-0 text-fg-danger">
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
    return <span className="text-fg-subtle">-</span>
  }

  return (
    <span className={itemRarity != null ? RARITY_TONES[itemRarity] : undefined}>{itemName}</span>
  )
}

export function WeeklyClears({ clears }: { clears: readonly TimelineClear[] }): React.JSX.Element {
  return (
    <TimelineGroup
      title="이번 주 클리어"
      count={clears.length}
      emptyText="이번 주 클리어 기록이 없습니다."
    >
      <ul className="m-0 list-none p-0">
        {clears.map((clear, index) => (
          <li
            key={`${clear.occurredAt}-${index}`}
            className="flex min-h-12 items-center gap-2 border-t border-line px-4 first:border-t-0"
          >
            <span className={`${BADGE} bg-inset`}>{CLEAR_KIND_LABELS[clear.kind]}</span>
            <span className="truncate font-semibold">{clear.name}</span>
            {clear.hard && <span className={`${BADGE} bg-inset`}>하드</span>}
            {clear.modeName != null && (
              <span className="whitespace-nowrap text-fg-muted">{clear.modeName}</span>
            )}
            <RelativeTime
              at={clear.occurredAt}
              className="ms-auto shrink-0 text-fg-subtle tabular-nums"
            />
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
      <ul className="m-0 flex list-none flex-wrap gap-2 p-3">
        {counts.map((count) => (
          <li
            key={`${count.kind}-${count.name}-${count.hard}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-control bg-control px-2 whitespace-nowrap"
          >
            <span className={`${BADGE} bg-canvas`}>{CLEAR_KIND_LABELS[count.kind]}</span>
            <span>{count.name}</span>
            {count.hard && <span className={`${BADGE} bg-canvas`}>하드</span>}
            <span className="font-mono font-semibold tabular-nums">{count.count}</span>
          </li>
        ))}
      </ul>
    </TimelineGroup>
  )
}

function HeaderCell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <th scope="col" className={`${tableClasses.headCell} text-left whitespace-nowrap`}>
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
      <table className={TABLE}>
        <colgroup>
          <col className={TIME_COLUMN} />
          <col className="w-14" />
          <col />
          <col className="w-20" />
          <col className="w-24" />
        </colgroup>
        <thead>
          <tr>
            <HeaderCell>일시</HeaderCell>
            <HeaderCell>종류</HeaderCell>
            <HeaderCell>장비</HeaderCell>
            <HeaderCell>수치</HeaderCell>
            <HeaderCell>결과</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {enhancements.map((enhancement, index) => (
            <tr key={`${enhancement.occurredAt}-${index}`} className={tableClasses.row}>
              <td className={`${CELL} text-fg-subtle tabular-nums`}>
                <RelativeTime at={enhancement.occurredAt} />
              </td>
              <td className={`${CELL} ${ENHANCEMENT_KIND_TONES[enhancement.kind]}`}>
                {ENHANCEMENT_KIND_LABELS[enhancement.kind]}
              </td>
              <td className={CELL}>
                <ItemName itemName={enhancement.itemName} itemRarity={enhancement.itemRarity} />
              </td>
              <td className={`${CELL} font-mono tabular-nums`}>
                {formatEnhancementValue(enhancement)}
              </td>
              <td className={CELL}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={enhancement.result ? 'text-fg-success' : 'text-fg-danger'}>
                    {enhancement.result ? '성공' : '실패'}
                  </span>
                  {enhancement.safe === true && <span className={`${BADGE} bg-inset`}>안전</span>}
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
      <table className={TABLE}>
        <colgroup>
          <col className={TIME_COLUMN} />
          <col />
          <col className="w-35" />
        </colgroup>
        <thead>
          <tr>
            <HeaderCell>일시</HeaderCell>
            <HeaderCell>장비</HeaderCell>
            <HeaderCell>경로</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {acquisitions.map((acquisition, index) => (
            <tr key={`${acquisition.occurredAt}-${index}`} className={tableClasses.row}>
              <td className={`${CELL} text-fg-subtle tabular-nums`}>
                <RelativeTime at={acquisition.occurredAt} />
              </td>
              <td className={CELL}>
                <ItemName itemName={acquisition.itemName} itemRarity={acquisition.itemRarity} />
              </td>
              <td className={`${CELL} text-fg-muted`}>{acquisitionRoute(acquisition.name)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {more}
    </TimelineGroup>
  )
}
