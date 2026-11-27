import {
  ENCHANT_GRADE_SLOTS,
  type EnchantGradeRole,
  type EnchantGradeSlot
} from '@dfragon/lib/enchant-grades'
import { LAB_ITEM_TIERS, type LabItemTier } from '@dfragon/lib/lab-items'
import { Button, Select, StatusChip, type StatusChipTone, Tabs } from '@dfragon/ui'
import { Fragment, useState } from 'react'
import type { LabCandidateQuery } from '#ops-api/ops-client'
import type {
  JobList,
  LabCandidate,
  LabCandidateBadge,
  LabCandidateKind,
  LabItemCost,
  Run
} from '#ops-api/ops-schemas'
import { formatCount, formatDateSecond } from '#ops-app/format'
import {
  useExcludeLabCandidate,
  useJobs,
  useLabCandidateIconUrl,
  useLabCandidates,
  useLabItems,
  useRefreshLabCandidatesAfterRun,
  useReplaceLabItems,
  useRequestRun
} from '#ops-app/ops-queries'
import {
  DEFAULT_SORT,
  detailOf,
  MISSING_VALUE,
  nextSort,
  optionsOf,
  priceChangeOf,
  rarityClassesOf,
  type Sort,
  type SortKey,
  sortCandidates
} from './lab-candidate-display'
import {
  groupsToSave,
  pendingTierChanges,
  savedCostOf,
  savedTierOf,
  type TierChanges,
  type TierSlot,
  tierChangeIdOf
} from './lab-candidate-tiers'
import { CATEGORY_NAMES, ROLE_NAMES } from './lab-item-names'
import { ICON_SIZE } from './lab-fields'
import { PriceHistoryRow } from './LabCandidatePriceHistory'
import { panelClasses } from './panel-classes'

const PRICE_JOB_NAME = 'lab-candidate-price-refresh'

const KIND_TABS: readonly { kind: LabCandidateKind; label: string }[] = [
  { kind: 'TITLE', label: '칭호' },
  { kind: 'CREATURE', label: '크리쳐' },
  { kind: 'AURA', label: '오라' },
  { kind: 'ENCHANT', label: '마법부여' }
]

const ENCHANT_ROLES: readonly EnchantGradeRole[] = ['dealer', 'buffer']

const SLOT_ITEMS = ENCHANT_GRADE_SLOTS.map((value) => ({ value, label: CATEGORY_NAMES[value] }))
const ROLE_ITEMS = ENCHANT_ROLES.map((value) => ({ value, label: ROLE_NAMES[value] }))

const NO_TIER = 'none'

type TierValue = LabItemTier | typeof NO_TIER

const TIER_ITEMS: readonly { value: TierValue; label: string }[] = [
  { value: NO_TIER, label: '없음' },
  ...LAB_ITEM_TIERS.map((value) => ({ value, label: value }))
]

const BADGE_TONES: Readonly<Record<LabCandidateBadge, StatusChipTone>> = {
  미조회: 'neutral',
  '검색 없음': 'danger',
  '매물 없음': 'warning'
}

const COLUMN_COUNT = 10

function queryOf(
  kind: LabCandidateKind,
  category: EnchantGradeSlot,
  role: EnchantGradeRole
): LabCandidateQuery {
  if (kind === 'ENCHANT') {
    return { kind, category, role }
  }

  return { kind }
}

function slotOf(query: LabCandidateQuery): TierSlot {
  if (query.kind === 'ENCHANT') {
    return { category: query.category, role: query.role }
  }

  return { category: query.kind, role: 'all' }
}

function LastRun({ run }: { run: Run | null }): React.JSX.Element | null {
  const finishedAt = run?.finishedAt ?? null

  if (finishedAt === null) {
    return null
  }

  return (
    <span className="text-xs text-fg-subtle">
      마지막 실행 <b className="num font-medium text-fg-muted">{formatDateSecond(finishedAt)}</b>
    </span>
  )
}

// 착용 수는 표를 통째로 바꾸므로 집계 시각이 모든 후보에 같다. 마법부여 후보는 착용 수를 세지 않아 비어 있다.
function WearCountedAt({
  candidates
}: {
  candidates: LabCandidate[] | undefined
}): React.JSX.Element | null {
  const countedAt = candidates?.find(({ wearCountedAt }) => wearCountedAt !== null)?.wearCountedAt

  if (countedAt == null) {
    return null
  }

  return (
    <span className="text-xs text-fg-subtle">
      착용 집계 <b className="num font-medium text-fg-muted">{formatDateSecond(countedAt)}</b>
    </span>
  )
}

function lastRunIdOf(jobs: JobList | undefined): number | null | undefined {
  if (jobs === undefined) {
    return undefined
  }

  const job = jobs.jobs.find(({ name }) => name === PRICE_JOB_NAME)
  const run = job?.lastFinishedRun ?? null

  if (run === null) {
    return null
  }

  return run.id
}

function PriceJobActions(): React.JSX.Element | null {
  const jobs = useJobs()
  const requestRun = useRequestRun()
  useRefreshLabCandidatesAfterRun(lastRunIdOf(jobs.data))

  if (jobs.data === undefined) {
    return null
  }

  const job = jobs.data.jobs.find(({ name }) => name === PRICE_JOB_NAME)

  if (job === undefined) {
    return (
      <span className="text-xs text-fg-subtle">worker가 후보 가격 job을 올리지 않았습니다.</span>
    )
  }

  const running = job.activeRun !== null

  function handleRun(): void {
    requestRun.mutate({ name: PRICE_JOB_NAME, args: {} })
  }

  return (
    <>
      {running ? (
        <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
          <span aria-hidden="true" className="status-spinner" />
          받는 중
        </span>
      ) : (
        <LastRun run={job.lastFinishedRun} />
      )}
      {requestRun.isError && !running && (
        <span role="alert" className="text-xs text-fg-danger">
          요청에 실패했습니다.
        </span>
      )}
      <Button size="sm" disabled={running || requestRun.isPending} onClick={handleRun}>
        지금 받기
      </Button>
    </>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  numeric,
  onSort
}: {
  label: string
  sortKey: SortKey
  sort: Sort
  numeric: boolean
  onSort: (key: SortKey) => void
}): React.JSX.Element {
  const sorted = sort.key === sortKey
  const ascending = sort.direction === 'asc'
  let ariaSort: 'ascending' | 'descending' | undefined
  let arrow = ''

  if (sorted) {
    ariaSort = ascending ? 'ascending' : 'descending'
    arrow = ascending ? ' ↑' : ' ↓'
  }

  function handleClick(): void {
    onSort(sortKey)
  }

  return (
    <th scope="col" aria-sort={ariaSort} className={numeric ? 'table-num' : undefined}>
      <button type="button" onClick={handleClick} className="cursor-pointer focus-ring">
        {label}
        {arrow}
      </button>
    </th>
  )
}

function CandidateIcon({ candidate }: { candidate: LabCandidate }): React.JSX.Element {
  const iconUrl = useLabCandidateIconUrl()
  const { icon } = rarityClassesOf(candidate.itemRarity)
  const { hasIcon, iconUpdatedAt, itemName } = candidate

  return (
    <span
      aria-hidden="true"
      className={`relative size-game-icon shrink-0 select-none box-border overflow-hidden rounded-control border bg-inset ${icon}`}
      style={{ borderColor: 'currentColor' }}
    >
      {hasIcon && iconUpdatedAt !== null && (
        <img
          src={iconUrl(itemName, iconUpdatedAt)}
          alt=""
          width={ICON_SIZE}
          height={ICON_SIZE}
          loading="lazy"
          className="block size-full object-contain"
        />
      )}
    </span>
  )
}

function PriceCell({
  candidate,
  expanded,
  onToggle
}: {
  candidate: LabCandidate
  expanded: boolean
  onToggle: (itemName: string) => void
}): React.JSX.Element {
  const change = priceChangeOf(candidate)

  function handleClick(): void {
    onToggle(candidate.itemName)
  }

  return (
    <td className="table-num">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${candidate.itemName} 가격 이력`}
        onClick={handleClick}
        className="w-full cursor-pointer text-right focus-ring"
      >
        {candidate.unitPrice !== null ? (
          <span className="block num font-semibold">{formatCount(candidate.unitPrice)}</span>
        ) : (
          <span className="text-fg-subtle">{MISSING_VALUE}</span>
        )}
        {change !== null && (
          <span
            className={`block text-2xs ${change.direction === 'up' ? 'text-fg-danger' : 'text-fg-success'}`}
          >
            {change.direction === 'up' ? '▲' : '▼'} {change.percent}
          </span>
        )}
      </button>
    </td>
  )
}

function TierSelect({
  itemName,
  tier,
  pending,
  locked,
  onChange
}: {
  itemName: string
  tier: LabItemTier | null
  pending: boolean
  locked: boolean
  onChange: (itemName: string, tier: LabItemTier | null) => void
}): React.JSX.Element {
  const label = `${itemName} 등급`

  function handleChange(value: string | null): void {
    const item = TIER_ITEMS.find((candidate) => candidate.value === value)

    if (item === undefined) {
      return
    }

    onChange(itemName, item.value === NO_TIER ? null : item.value)
  }

  return (
    <span className="inline-flex items-center">
      <Select.Root
        value={tier ?? NO_TIER}
        onValueChange={handleChange}
        items={TIER_ITEMS}
        disabled={locked}
      >
        <Select.Trigger size="sm" aria-label={label}>
          <Select.Value />
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          {TIER_ITEMS.map((item) => (
            <Select.Item key={item.value} value={item.value}>
              <Select.ItemText>{item.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
      {pending && (
        <span
          role="img"
          aria-label="저장 전"
          className="ml-1 inline-block size-[6px] rounded-badge bg-signal"
        />
      )}
    </span>
  )
}

type CandidateRowProps = {
  candidate: LabCandidate
  tier: LabItemTier | null
  pending: boolean
  locked: boolean
  selected: boolean
  expanded: boolean
  onToggle: (itemName: string) => void
  onTierChange: (itemName: string, tier: LabItemTier | null) => void
  onExclude: (itemName: string) => void
}

function CandidateRow({
  candidate,
  tier,
  pending,
  locked,
  selected,
  expanded,
  onToggle,
  onTierChange,
  onExclude
}: CandidateRowProps): React.JSX.Element {
  const { name } = rarityClassesOf(candidate.itemRarity)
  const options = optionsOf(candidate)
  const buff = candidate.buffLines.join(', ')

  function handleExclude(): void {
    onExclude(candidate.itemName)
  }

  return (
    <tr>
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <CandidateIcon candidate={candidate} />
          <span className="flex min-w-0 flex-col">
            <span className={`min-w-0 truncate font-semibold ${name}`}>{candidate.itemName}</span>
            <span className="text-2xs text-fg-subtle">{detailOf(candidate)}</span>
          </span>
        </div>
      </td>
      <td className="table-num">
        {candidate.fame !== null ? formatCount(candidate.fame) : MISSING_VALUE}
      </td>
      <td>
        <span className="block truncate" title={options}>
          {options !== '' ? options : MISSING_VALUE}
        </span>
      </td>
      <td>
        <span className="block truncate text-fg-muted">{buff !== '' ? buff : MISSING_VALUE}</span>
      </td>
      <PriceCell candidate={candidate} expanded={expanded} onToggle={onToggle} />
      <td className="table-num">
        {candidate.wearCount !== null ? formatCount(candidate.wearCount) : MISSING_VALUE}
      </td>
      <td>
        {candidate.badge !== null && (
          <StatusChip tone={BADGE_TONES[candidate.badge]}>{candidate.badge}</StatusChip>
        )}
      </td>
      <td className="text-center text-fg-muted">{candidate.recommendedTier ?? MISSING_VALUE}</td>
      <td>
        <TierSelect
          itemName={candidate.itemName}
          tier={tier}
          pending={pending}
          locked={locked}
          onChange={onTierChange}
        />
      </td>
      <td className="table-num">
        <Button
          size="sm"
          disabled={locked || selected}
          aria-label={`${candidate.itemName} 제외`}
          onClick={handleExclude}
        >
          제외
        </Button>
      </td>
    </tr>
  )
}

function EnchantFilters({
  category,
  role,
  onCategoryChange,
  onRoleChange
}: {
  category: EnchantGradeSlot
  role: EnchantGradeRole
  onCategoryChange: (category: EnchantGradeSlot) => void
  onRoleChange: (role: EnchantGradeRole) => void
}): React.JSX.Element {
  function handleCategoryChange(value: EnchantGradeSlot | null): void {
    if (value !== null) {
      onCategoryChange(value)
    }
  }

  function handleRoleChange(value: EnchantGradeRole | null): void {
    if (value !== null) {
      onRoleChange(value)
    }
  }

  return (
    <>
      <span aria-hidden="true" className="divider-v" />
      <div className="field">
        <span className="field-label">부위</span>
        <Select.Root value={category} onValueChange={handleCategoryChange} items={SLOT_ITEMS}>
          <Select.Trigger size="sm" aria-label="부위">
            <Select.Value />
          </Select.Trigger>
          <Select.Popup aria-label="부위">
            {SLOT_ITEMS.map((item) => (
              <Select.Item key={item.value} value={item.value}>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
      </div>
      <div className="field">
        <span className="field-label">역할</span>
        <Select.Root value={role} onValueChange={handleRoleChange} items={ROLE_ITEMS}>
          <Select.Trigger size="sm" aria-label="역할">
            <Select.Value />
          </Select.Trigger>
          <Select.Popup aria-label="역할">
            {ROLE_ITEMS.map((item) => (
              <Select.Item key={item.value} value={item.value}>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
      </div>
    </>
  )
}

type CandidateTableProps = {
  candidates: readonly LabCandidate[]
  sort: Sort
  expanded: string | null
  tierOf: (itemName: string) => LabItemTier | null
  isPending: (itemName: string) => boolean
  isSelected: (itemName: string) => boolean
  locked: boolean
  onSort: (key: SortKey) => void
  onToggle: (itemName: string) => void
  onTierChange: (itemName: string, tier: LabItemTier | null) => void
  onExclude: (itemName: string) => void
}

function CandidateTable({
  candidates,
  sort,
  expanded,
  tierOf,
  isPending,
  isSelected,
  locked,
  onSort,
  onToggle,
  onTierChange,
  onExclude
}: CandidateTableProps): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table table-fixed table-wide table-wrap">
        <colgroup>
          <col className="w-[240px]" />
          <col className="w-[76px]" />
          <col />
          <col className="w-[150px]" />
          <col className="w-[140px]" />
          <col className="w-[64px]" />
          <col className="w-[112px]" />
          <col className="w-[72px]" />
          <col className="w-[112px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead>
          <tr>
            <SortHeader label="이름" sortKey="name" sort={sort} numeric={false} onSort={onSort} />
            <SortHeader label="명성" sortKey="fame" sort={sort} numeric onSort={onSort} />
            <th scope="col">옵션</th>
            <th scope="col">버프</th>
            <SortHeader label="최저가" sortKey="price" sort={sort} numeric onSort={onSort} />
            <SortHeader label="착용" sortKey="wear" sort={sort} numeric onSort={onSort} />
            <th scope="col">상태</th>
            <th scope="col" className="text-center">
              추천
            </th>
            <th scope="col">등급</th>
            <th scope="col" aria-label="제외" />
          </tr>
        </thead>
        <tbody>
          {sortCandidates(candidates, sort).map((candidate) => {
            const { itemName } = candidate
            const open = expanded === itemName

            return (
              <Fragment key={itemName}>
                <CandidateRow
                  candidate={candidate}
                  tier={tierOf(itemName)}
                  pending={isPending(itemName)}
                  locked={locked}
                  selected={isSelected(itemName)}
                  expanded={open}
                  onToggle={onToggle}
                  onTierChange={onTierChange}
                  onExclude={onExclude}
                />
                {open && <PriceHistoryRow itemName={itemName} columns={COLUMN_COUNT} />}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function LabCandidatePanel(): React.JSX.Element {
  const [kind, setKind] = useState<LabCandidateKind>('TITLE')
  const [category, setCategory] = useState<EnchantGradeSlot>('WEAPON')
  const [role, setRole] = useState<EnchantGradeRole>('dealer')
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const [changes, setChanges] = useState<TierChanges>(new Map())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const query = queryOf(kind, category, role)
  const slot = slotOf(query)
  const candidates = useLabCandidates(query)
  const labItems = useLabItems()
  const replaceLabItems = useReplaceLabItems()
  const excludeLabCandidate = useExcludeLabCandidate()
  const groups = labItems.data?.groups ?? []
  // 저장된 묶음을 읽기 전에 저장하면 빈 묶음에서 시작한 목록이 다른 아이템을 지운다.
  const ready = candidates.data !== undefined && labItems.data !== undefined && !labItems.isError
  const pending = pendingTierChanges(groups, changes)
  const pendingIds = new Set(pending.map((change) => tierChangeIdOf(change, change.itemName)))

  function tierOf(itemName: string): LabItemTier | null {
    const change = changes.get(tierChangeIdOf(slot, itemName))

    if (change !== undefined) {
      return change.tier
    }

    return savedTierOf(groups, slot, itemName)
  }

  function isPending(itemName: string): boolean {
    return pendingIds.has(tierChangeIdOf(slot, itemName))
  }

  function isSelected(itemName: string): boolean {
    return groups.some(({ items }) => items.some((item) => item.itemName === itemName))
  }

  function exclude(itemName: string): void {
    excludeLabCandidate.mutate(itemName, {
      onSuccess: () => {
        setChanges((current) => {
          const next = new Map(current)

          for (const [id, change] of current) {
            if (change.itemName === itemName) {
              next.delete(id)
            }
          }

          return next
        })
      }
    })
  }

  function changeTier(itemName: string, tier: LabItemTier | null): void {
    const id = tierChangeIdOf(slot, itemName)
    const next = new Map(changes)

    if (tier === savedTierOf(groups, slot, itemName)) {
      next.delete(id)
    } else {
      const cost = changeCostOf(itemName)
      next.set(id, { ...slot, itemName, tier, cost })
    }

    setChanges(next)
  }

  function changeCostOf(itemName: string): LabItemCost | null {
    const saved = savedCostOf(groups, slot, itemName)

    if (saved !== null) {
      return saved
    }

    const change = changes.get(tierChangeIdOf(slot, itemName))

    if (change === undefined) {
      return null
    }

    return change.cost
  }

  function applyRecommendations(): void {
    if (!ready || saving) {
      return
    }

    const next = new Map(changes)

    for (const { itemName, recommendedTier } of candidates.data.candidates) {
      if (recommendedTier !== null && tierOf(itemName) === null) {
        const cost = changeCostOf(itemName)
        next.set(tierChangeIdOf(slot, itemName), { ...slot, itemName, tier: recommendedTier, cost })
      }
    }

    setChanges(next)
  }

  function toggleHistory(itemName: string): void {
    setExpanded(expanded === itemName ? null : itemName)
  }

  function changeSort(key: SortKey): void {
    setSort(nextSort(sort, key))
  }

  function handleKindChange(value: unknown): void {
    const tab = KIND_TABS.find((candidate) => candidate.kind === value)

    if (tab !== undefined) {
      setKind(tab.kind)
    }
  }

  async function save(): Promise<void> {
    if (!ready) {
      return
    }

    setSaving(true)
    setSaveFailed(false)

    try {
      for (const group of groupsToSave(groups, changes)) {
        await replaceLabItems.mutateAsync(group)
      }

      setChanges(new Map())
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  function body(): React.JSX.Element {
    if (candidates.isError) {
      return (
        <p role="alert" className="state state-error">
          실험실 후보를 읽지 못했습니다.
        </p>
      )
    }

    if (labItems.isError) {
      return (
        <p role="alert" className="state state-error">
          실험실 아이템을 읽지 못했습니다.
        </p>
      )
    }

    if (candidates.data === undefined || labItems.data === undefined) {
      return (
        <div role="status" className="state state-pending">
          <span aria-hidden="true" className="loading-line">
            <span />
          </span>
        </div>
      )
    }

    if (candidates.data.candidates.length === 0) {
      return <p className="state">후보가 없습니다. 데이터 묶음을 import하면 보입니다.</p>
    }

    return (
      <CandidateTable
        candidates={candidates.data.candidates}
        sort={sort}
        expanded={expanded}
        tierOf={tierOf}
        isPending={isPending}
        isSelected={isSelected}
        locked={saving || excludeLabCandidate.isPending}
        onSort={changeSort}
        onToggle={toggleHistory}
        onTierChange={changeTier}
        onExclude={exclude}
      />
    )
  }

  return (
    <section aria-label="실험실 후보" className={panelClasses.box}>
      <h2 className="section-title">
        실험실 후보
        <span className="section-title-actions">
          <PriceJobActions />
        </span>
      </h2>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
        <Tabs.Root value={kind} onValueChange={handleKindChange}>
          <Tabs.List aria-label="후보 종류" render={<div className="shadow-none" />}>
            {KIND_TABS.map((tab) => (
              <Tabs.Tab key={tab.kind} value={tab.kind}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.Root>
        {kind === 'ENCHANT' && (
          <EnchantFilters
            category={category}
            role={role}
            onCategoryChange={setCategory}
            onRoleChange={setRole}
          />
        )}
        <span className="grow" />
        <WearCountedAt candidates={candidates.data?.candidates} />
        {pending.length > 0 && (
          <span className="text-xs text-fg-subtle">
            변경 <b className="num">{pending.length}</b>
          </span>
        )}
        <Button size="sm" disabled={!ready || saving} onClick={applyRecommendations}>
          추천 적용
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!ready || saving || pending.length === 0}
          onClick={save}
        >
          저장
        </Button>
      </div>
      {saveFailed && (
        <p role="alert" className="state state-error">
          저장하지 못했습니다.
        </p>
      )}
      {excludeLabCandidate.isError && (
        <p role="alert" className="state state-error">
          제외하지 못했습니다.
        </p>
      )}
      {body()}
    </section>
  )
}
