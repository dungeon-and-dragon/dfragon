import { Button } from '@dfragon/ui'
import { Link } from '@tanstack/react-router'
import {
  ADVENTURE_TIMELINE_KINDS,
  type AdventureTimelineItem,
  type AdventureTimelineKind
} from '#entities/adventure-guild'
import {
  acquisitionRoute,
  ENHANCEMENT_KIND_LABELS,
  enhancementKindClasses,
  formatEnhancementValue,
  raritySolidOfName
} from '#entities/character'
import { ChoiceField } from '#shared/ui/ChoiceField'
import { LoadingLine } from '#shared/ui/LoadingLine'
import { RelativeTime } from '#shared/ui/RelativeTime'
import { AdventureTabsForm } from './AdventureTabsForm'
import { AdventureTabs } from './AdventureTabs'
import { type AdventureTimelinePages, useAdventureTimeline } from './api/useAdventureTimeline'
import { adventureTabsHeight } from './sticky-head'
import type { TimelineSearch } from './timeline-search'
import { useObservedHeight } from './use-observed-height'

const ALL_KINDS = 'all'
const KIND_ITEMS = [
  { value: ALL_KINDS, label: '전체' },
  { value: 'enhancement', label: '강화' },
  { value: 'acquisition', label: '드랍' },
  { value: 'clear', label: '클리어' }
] as const satisfies readonly { value: AdventureTimelineKind | typeof ALL_KINDS; label: string }[]

const HARD_BADGE = 'badge bg-danger-weak text-fg-danger'
const MORE = 'min-h-12 border-t border-line'
const MORE_STATE = `${MORE} flex-row py-0`

function toKind(value: string): AdventureTimelineKind | undefined {
  return ADVENTURE_TIMELINE_KINDS.find((kind) => kind === value)
}

function KindPicker({
  kind,
  onChange
}: {
  kind: AdventureTimelineKind | undefined
  onChange: (search: TimelineSearch) => void
}): React.JSX.Element {
  function changeKind(value: string): void {
    onChange({ kind: toKind(value) })
  }

  return (
    <div className="section flex items-start gap-4 px-4 max-sm:flex-col max-sm:gap-1">
      <h3 className="label m-0 flex h-8 w-16 shrink-0 items-center max-sm:h-auto max-sm:w-auto">
        종류
      </h3>
      <ChoiceField
        label="종류"
        items={KIND_ITEMS}
        value={kind ?? ALL_KINDS}
        onValueChange={changeKind}
      />
    </div>
  )
}

function TargetCell({ item }: { item: AdventureTimelineItem }): React.JSX.Element {
  if (item.type === 'clear') {
    return <td className="truncate">{item.name}</td>
  }

  const { itemName, itemRarity } = item

  if (itemName == null) {
    return <td className="text-fg-subtle">-</td>
  }

  const rarityClass = itemRarity != null ? raritySolidOfName(itemRarity) : ''

  return <td className={`truncate ${rarityClass}`}>{itemName}</td>
}

function KindCell({ item }: { item: AdventureTimelineItem }): React.JSX.Element {
  if (item.type === 'acquisition') {
    return <td className="text-fg-muted">드랍</td>
  }

  if (item.type === 'clear') {
    return <td className="text-fg-muted">클리어</td>
  }

  return <td className={enhancementKindClasses[item.kind]}>{ENHANCEMENT_KIND_LABELS[item.kind]}</td>
}

function DetailCell({ item }: { item: AdventureTimelineItem }): React.JSX.Element {
  if (item.type === 'acquisition') {
    return <td className="text-fg-muted">{acquisitionRoute(item.name)}</td>
  }

  if (item.type === 'clear') {
    return (
      <td>
        <span className="inline-flex min-w-0 items-center gap-2">
          {item.hard && <span className={HARD_BADGE}>하드</span>}
          {item.modeName !== null && (
            <span className="truncate text-fg-muted">{item.modeName}</span>
          )}
        </span>
      </td>
    )
  }

  return (
    <td>
      <span className="inline-flex items-center gap-2">
        <span className="num">{formatEnhancementValue(item)}</span>
        <span className={item.result ? 'text-fg-success' : 'text-fg-danger'}>
          {item.result ? '성공' : '실패'}
        </span>
        {item.safe === true && <span className="badge bg-inset text-fg-muted">안전</span>}
      </span>
    </td>
  )
}

function TimelineMore({ pages }: { pages: AdventureTimelinePages }): React.JSX.Element | null {
  if (pages.loadingMore) {
    return (
      <div aria-busy="true" className={`state state-pending ${MORE_STATE}`}>
        <LoadingLine short />
        <span role="status">기록을 더 받는 중입니다.</span>
      </div>
    )
  }

  if (pages.moreError !== null) {
    return (
      <div className={`state state-error ${MORE_STATE}`}>
        <p role="alert" className="m-0">
          {pages.moreError}
        </p>
        <Button variant="secondary" size="sm" onClick={pages.loadMore}>
          다시 시도
        </Button>
      </div>
    )
  }

  if (!pages.hasMore) {
    return null
  }

  return (
    <div className={`${MORE} flex items-center justify-center`}>
      <Button variant="secondary" size="sm" onClick={pages.loadMore}>
        불러오기
      </Button>
    </div>
  )
}

function TimelineTable({ pages }: { pages: AdventureTimelinePages }): React.JSX.Element {
  if (pages.items.length === 0) {
    return <p className="state">기록이 없습니다.</p>
  }

  return (
    <>
      <div className="table-scroll">
        <table className="table table-fixed max-md:min-w-[640px]">
          <colgroup>
            <col className="w-[112px]" />
            <col className="w-[160px]" />
            <col className="w-[64px]" />
            <col />
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">일시</th>
              <th scope="col">캐릭터</th>
              <th scope="col">종류</th>
              <th scope="col">대상</th>
              <th scope="col">내용</th>
            </tr>
          </thead>
          <tbody>
            {pages.items.map((item, index) => (
              <tr key={`${item.serverId}-${item.characterId}-${item.occurredAt}-${index}`}>
                <td className="text-fg-subtle tabular-nums">
                  <RelativeTime at={item.occurredAt} />
                </td>
                <td className="truncate">
                  <Link
                    to="/c/$serverId/$characterId"
                    params={{ serverId: item.serverId, characterId: item.characterId }}
                    className="link font-semibold text-fg"
                  >
                    {item.characterName}
                  </Link>
                </td>
                <KindCell item={item} />
                <TargetCell item={item} />
                <DetailCell item={item} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TimelineMore pages={pages} />
    </>
  )
}

function TimelineBody({
  adventureName,
  kind
}: {
  adventureName: string
  kind: AdventureTimelineKind | undefined
}): React.JSX.Element {
  const result = useAdventureTimeline(adventureName, kind)

  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className="state state-pending">
          <LoadingLine />
          <span role="status">타임라인을 받는 중입니다.</span>
        </div>
      )
    case 'error':
      return (
        <p role="alert" className="state state-error">
          {result.message}
        </p>
      )
    case 'success':
      return <TimelineTable pages={result.value} />
  }
}

export function AdventureTimelineScreen({
  adventureName,
  search,
  onSearchChange,
  onAdventureOpen
}: {
  adventureName: string
  search: TimelineSearch
  onSearchChange: (search: TimelineSearch) => void
  onAdventureOpen: (adventureName: string) => void
}): React.JSX.Element {
  const [observeTabs, tabsHeight] = useObservedHeight()

  return (
    <div className="flex flex-col" style={adventureTabsHeight(tabsHeight)}>
      <AdventureTabs
        ref={observeTabs}
        adventureName={adventureName}
        actions={
          <AdventureTabsForm adventureName={adventureName} onAdventureOpen={onAdventureOpen} />
        }
      />
      <KindPicker kind={search.kind} onChange={onSearchChange} />
      <section aria-label="타임라인" className="section min-w-0 text-sm">
        <h2 className="section-title">타임라인</h2>
        <TimelineBody adventureName={adventureName} kind={search.kind} />
      </section>
    </div>
  )
}
