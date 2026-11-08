import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import type {
  ActivitySummary as Summary,
  EnhancementTarget
} from '#core/adventure-guild/adventure-activity'
import { styles } from './ActivitySummary.style'
import { formatClearCount } from './clear-count'

const numberFormat = new Intl.NumberFormat('ko-KR')

type NameCount = Summary['raids'][number]

function sumCounts(counts: readonly NameCount[]): number {
  return counts.reduce((total, { count }) => total + count, 0)
}

function DetailRow({
  label,
  labelStyle,
  value
}: {
  label: ReactNode
  labelStyle?: stylex.StyleXStyles
  value: string
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(labelStyle)}>{label}</span>
      <span {...stylex.props(styles.count)}>{value}</span>
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
      <Tooltip.Trigger
        delay={0}
        closeDelay={0}
        render={<div tabIndex={0} {...stylex.props(styles.stat)} />}
      >
        <span {...stylex.props(styles.label)}>{label}</span>
        <b {...stylex.props(styles.value)}>{numberFormat.format(value)}</b>
      </Tooltip.Trigger>
      <Tooltip.Popup side="bottom" align="start" sideOffset={8}>
        <div {...stylex.props(styles.detail)}>{children}</div>
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
  labelStyle
}: {
  title: string
  targets: readonly EnhancementTarget[]
  labelStyle: stylex.StyleXStyles
}): React.JSX.Element | null {
  if (targets.length === 0) {
    return null
  }

  return (
    <>
      <div {...stylex.props(styles.group)}>{title}</div>
      {targets.toReversed().map((target) => (
        <DetailRow
          key={target.target}
          label={`+${target.target}`}
          labelStyle={labelStyle}
          value={successRate(target)}
        />
      ))}
    </>
  )
}

export function ActivitySummary({ summary }: { summary: Summary }): React.JSX.Element {
  const { items, enhancement } = summary
  const itemCount = items.legendary + items.epic + items.primeval + items.mythic
  const hasTargets = enhancement.amplify.length > 0 || enhancement.reinforce.length > 0

  return (
    <div {...stylex.props(styles.stats)}>
      <SummaryStat label="레이드" value={sumCounts(summary.raids)}>
        <ClearRows counts={summary.raids} />
      </SummaryStat>
      <SummaryStat label="레기온" value={sumCounts(summary.legions)}>
        <ClearRows counts={summary.legions} />
      </SummaryStat>
      <SummaryStat label="아이템" value={itemCount}>
        {items.legendary > 0 && (
          <DetailRow
            label="레전더리"
            labelStyle={styles.legendary}
            value={`${numberFormat.format(items.legendary)}개`}
          />
        )}
        {items.epic > 0 && (
          <DetailRow
            label="에픽"
            labelStyle={styles.epic}
            value={`${numberFormat.format(items.epic)}개`}
          />
        )}
        {items.primeval > 0 && (
          <DetailRow
            label="태초"
            labelStyle={styles.primordial}
            value={`${numberFormat.format(items.primeval)}개`}
          />
        )}
        {items.mythic > 0 && (
          <DetailRow
            label="신화"
            labelStyle={styles.mythic}
            value={`${numberFormat.format(items.mythic)}개`}
          />
        )}
      </SummaryStat>
      <SummaryStat label="강화" value={enhancement.attempts}>
        <TargetRows title="증폭" targets={enhancement.amplify} labelStyle={styles.amplify} />
        <TargetRows title="강화" targets={enhancement.reinforce} labelStyle={styles.reinforce} />
        {hasTargets && <div {...stylex.props(styles.divider)} />}
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

export function ActivitySummarySkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" {...stylex.props(styles.stats)}>
      {['레이드', '레기온', '아이템', '강화'].map((label) => (
        <div key={label} {...stylex.props(styles.stat)}>
          <span {...stylex.props(styles.label)}>{label}</span>
          <span {...stylex.props(styles.bone)} />
        </div>
      ))}
    </div>
  )
}
