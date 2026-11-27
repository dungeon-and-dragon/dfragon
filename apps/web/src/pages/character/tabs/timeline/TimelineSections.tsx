import { Button } from '@dfragon/ui'
import type { ReactNode } from 'react'
import type { TimelinePagesState } from '#pages/character/hooks/useTimelinePages'
import { LoadingLine } from '#shared/ui/LoadingLine'
import { RelativeTime } from '#shared/ui/RelativeTime'
import {
  acquisitionRoute,
  CLEAR_KIND_LABELS,
  ENHANCEMENT_KIND_LABELS,
  formatEnhancementValue,
  type TimelineAcquisition,
  type TimelineClearCount,
  type TimelineEnhancement,
  enhancementKindClasses,
  raritySolidOfName
} from '#entities/character'

const BADGE = 'badge text-fg-muted'
const HARD_BADGE = 'badge bg-danger-weak text-fg-danger'
const TABLE = 'table table-fixed'
const TIME_COLUMN = 'w-[112px]'
const MORE = 'min-h-12 border-t border-line'
const MORE_STATE = `${MORE} flex-row py-0`

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
    <section aria-label={title} className="min-w-0">
      <h2 className="section-title whitespace-nowrap">
        <span>{title}</span>
        <span className="section-title-count">{count}</span>
        {note !== undefined && <span className="label">{note}</span>}
      </h2>
      {count === 0 ? <p className="m-0 px-4 py-3 text-fg-subtle">{emptyText}</p> : children}
    </section>
  )
}

export function TimelineMore({
  canShowMore,
  state,
  onShowMore,
  onRetry
}: {
  canShowMore: boolean
  state: TimelinePagesState
  onShowMore: () => void
  onRetry: () => void
}): React.JSX.Element | null {
  if (state.status === 'loading') {
    return (
      <div aria-busy="true" className={`state state-pending ${MORE_STATE}`}>
        <LoadingLine short />
        <span role="status">기록을 더 받는 중입니다.</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={`state state-error ${MORE_STATE}`}>
        <p role="alert" className="m-0">
          {state.message}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    )
  }

  if (!canShowMore) {
    return null
  }

  return (
    <div className={`${MORE} flex items-center justify-center`}>
      <Button variant="secondary" size="sm" onClick={onShowMore}>
        불러오기
      </Button>
    </div>
  )
}

function ItemName({
  itemName,
  itemRarity
}: Pick<TimelineEnhancement, 'itemName' | 'itemRarity'>): React.JSX.Element {
  if (itemName == null) {
    return <span className="text-fg-subtle">-</span>
  }

  return (
    <span className={itemRarity != null ? raritySolidOfName(itemRarity) : undefined}>
      {itemName}
    </span>
  )
}

export function SeasonClears({
  counts
}: {
  counts: readonly TimelineClearCount[]
}): React.JSX.Element {
  return (
    <TimelineGroup
      title="이번 시즌 클리어"
      count={counts.length}
      emptyText="이번 시즌 클리어 기록이 없습니다."
    >
      <ul className="m-0 flex list-none flex-wrap gap-2 px-4 py-3">
        {counts.map((count) => (
          <li
            key={`${count.kind}-${count.name}-${count.hard}`}
            className="inline-flex h-8 items-center gap-2 rounded-control bg-control px-2 whitespace-nowrap"
          >
            <span className={`${BADGE} bg-canvas`}>{CLEAR_KIND_LABELS[count.kind]}</span>
            {count.hard && <span className={HARD_BADGE}>하드</span>}
            <span>{count.name}</span>
            <span className="num font-semibold">{count.count}</span>
          </li>
        ))}
      </ul>
    </TimelineGroup>
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
      <div className="table-scroll">
        <table className={`${TABLE} max-md:min-w-[480px]`}>
          <colgroup>
            <col className={TIME_COLUMN} />
            <col className="w-[56px]" />
            <col />
            <col className="w-[80px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">일시</th>
              <th scope="col">종류</th>
              <th scope="col">장비</th>
              <th scope="col">수치</th>
              <th scope="col">결과</th>
            </tr>
          </thead>
          <tbody>
            {enhancements.map((enhancement, index) => (
              <tr key={`${enhancement.occurredAt}-${index}`}>
                <td className="text-fg-subtle tabular-nums">
                  <RelativeTime at={enhancement.occurredAt} />
                </td>
                <td className={enhancementKindClasses[enhancement.kind]}>
                  {ENHANCEMENT_KIND_LABELS[enhancement.kind]}
                </td>
                <td>
                  <ItemName itemName={enhancement.itemName} itemRarity={enhancement.itemRarity} />
                </td>
                <td className="num">{formatEnhancementValue(enhancement)}</td>
                <td>
                  <span className="inline-flex items-center gap-2">
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
      </div>
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
      <div className="table-scroll">
        <table className={TABLE}>
          <colgroup>
            <col className={TIME_COLUMN} />
            <col />
            <col className="w-[140px]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">일시</th>
              <th scope="col">장비</th>
              <th scope="col">경로</th>
            </tr>
          </thead>
          <tbody>
            {acquisitions.map((acquisition, index) => (
              <tr key={`${acquisition.occurredAt}-${index}`}>
                <td className="text-fg-subtle tabular-nums">
                  <RelativeTime at={acquisition.occurredAt} />
                </td>
                <td>
                  <ItemName itemName={acquisition.itemName} itemRarity={acquisition.itemRarity} />
                </td>
                <td className="text-fg-muted">{acquisitionRoute(acquisition.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more}
    </TimelineGroup>
  )
}
