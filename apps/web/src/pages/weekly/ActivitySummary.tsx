import { Tooltip } from '@dfragon/ui'
import type { ReactNode } from 'react'
import type { ActivitySummary as Summary, EnhancementTarget } from '#core/adventure-guild'
import { formatClearCount } from './clear-count'

const numberFormat = new Intl.NumberFormat('ko-KR')

const STATS = 'flex gap-8'
const STAT = 'stat items-start focus-ring'
const STAT_LABEL = 'stat-label whitespace-nowrap'
const GRADIENT_TEXT = 'bg-clip-text text-transparent'

type NameCount = Summary['raids'][number]

function sumCounts(counts: readonly NameCount[]): number {
  return counts.reduce((total, { count }) => total + count, 0)
}

function DetailRow({
  label,
  labelTone,
  value
}: {
  label: ReactNode
  labelTone?: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex justify-between gap-4 py-1 text-xs">
      <span className={labelTone}>{label}</span>
      <span className="num text-fg-muted">{value}</span>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  children
}: {
  label: string
  value: number
  children: ReactNode
}): React.JSX.Element {
  return (
    <Tooltip.Root disabled={value === 0}>
      <Tooltip.Trigger delay={0} closeDelay={0} render={<div tabIndex={0} className={STAT} />}>
        <span className={STAT_LABEL}>{label}</span>
        <b className="stat-value [text-shadow:0_1px_8px_color-mix(in_srgb,var(--color-canvas)_60%,transparent)]">
          {numberFormat.format(value)}
        </b>
      </Tooltip.Trigger>
      <Tooltip.Popup side="bottom" align="start" sideOffset={8}>
        <div className="flex min-w-[200px] flex-col text-fg">{children}</div>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function ClearRows({ counts }: { counts: readonly NameCount[] }): React.JSX.Element {
  return (
    <>
      {counts.map((clear) => (
        <DetailRow key={clear.name} label={clear.name} value={formatClearCount(clear)} />
      ))}
    </>
  )
}

function successRate({ attempts, successes }: EnhancementTarget): string {
  return `(${successes}/${attempts} ${Math.round((successes / attempts) * 100)}%)`
}

function TargetRows({
  title,
  targets,
  labelTone
}: {
  title: string
  targets: readonly EnhancementTarget[]
  labelTone: string
}): React.JSX.Element | null {
  if (targets.length === 0) {
    return null
  }

  return (
    <>
      <div className="label pt-2 pb-1">{title}</div>
      {targets.toReversed().map((target) => (
        <DetailRow
          key={target.target}
          label={`+${target.target}`}
          labelTone={`num ${labelTone}`}
          value={successRate(target)}
        />
      ))}
    </>
  )
}

export function ActivitySummary({
  summary,
  hasLegion
}: {
  summary: Summary
  hasLegion: boolean
}): React.JSX.Element {
  const { items, enhancement } = summary
  const itemCount = items.legendary + items.epic + items.primeval + items.mythic
  const hasTargets = enhancement.amplify.length > 0 || enhancement.reinforce.length > 0

  return (
    <div className={STATS}>
      <SummaryStat label="레이드" value={sumCounts(summary.raids)}>
        <ClearRows counts={summary.raids} />
      </SummaryStat>
      {hasLegion && (
        <SummaryStat label="레기온" value={sumCounts(summary.legions)}>
          <ClearRows counts={summary.legions} />
        </SummaryStat>
      )}
      <SummaryStat label="아이템" value={itemCount}>
        {items.legendary > 0 && (
          <DetailRow
            label="레전더리"
            labelTone="text-rarity-legendary"
            value={`${numberFormat.format(items.legendary)}개`}
          />
        )}
        {items.epic > 0 && (
          <DetailRow
            label="에픽"
            labelTone="text-rarity-epic"
            value={`${numberFormat.format(items.epic)}개`}
          />
        )}
        {items.primeval > 0 && (
          <DetailRow
            label="태초"
            labelTone={`bg-(image:--gradient-rarity-primordial) ${GRADIENT_TEXT}`}
            value={`${numberFormat.format(items.primeval)}개`}
          />
        )}
        {items.mythic > 0 && (
          <DetailRow
            label="신화"
            labelTone={`bg-(image:--gradient-rarity-mythic) ${GRADIENT_TEXT}`}
            value={`${numberFormat.format(items.mythic)}개`}
          />
        )}
      </SummaryStat>
      <SummaryStat label="강화" value={enhancement.attempts}>
        <TargetRows title="증폭" targets={enhancement.amplify} labelTone="text-game-amplify" />
        <TargetRows title="강화" targets={enhancement.reinforce} labelTone="text-game-enhance" />
        {hasTargets && <div className="mt-1 border-t border-line" />}
        <DetailRow
          label="10증폭 미만"
          value={`${numberFormat.format(enhancement.amplifyBelow10)}회`}
        />
        <DetailRow
          label="12강 미만"
          value={`${numberFormat.format(enhancement.reinforceBelow12)}회`}
        />
        <DetailRow label="재련" value={`${numberFormat.format(enhancement.refine)}회`} />
      </SummaryStat>
    </div>
  )
}

export function ActivitySummarySkeleton({ hasLegion }: { hasLegion: boolean }): React.JSX.Element {
  const labels = hasLegion ? ['레이드', '레기온', '아이템', '강화'] : ['레이드', '아이템', '강화']

  return (
    <div aria-hidden="true" className={STATS}>
      {labels.map((label) => (
        <div key={label} className={STAT}>
          <span className={STAT_LABEL}>{label}</span>
          <span className="skeleton-text my-[9px] w-[40px]" />
        </div>
      ))}
    </div>
  )
}
