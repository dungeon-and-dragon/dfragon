import { Tooltip, type TooltipPopupProps } from '@dfragon/ui'
import { Fragment } from 'react'
import { formatSeoulDateTime } from '#shared/lib/time-format'
import {
  MALE_CRUSADER_DEALER_SKILL,
  MALE_CRUSADER_ROLE_LABELS,
  type MaleCrusaderRole
} from '#entities/character'
import {
  type SkillAdoption,
  type SkillStats,
  type SkillUpgradeRates,
  skillAdoptionOf
} from '#entities/ranking'
import { type SkillMarks, skillMarkOf, type UpgradeType } from '#entities/catalog'
import { PIXELATED, SKILL_TOOLTIP } from './skill-classes'
import { ENHANCEMENT_LABELS, EVOLUTION_NUMERALS } from './upgrade-labels'

const UPGRADE_TYPES = [1, 2] as const satisfies readonly UpgradeType[]

const integer = new Intl.NumberFormat('ko-KR')

const ROWS = 'grid grid-cols-[auto_auto] items-center gap-x-6 gap-y-1'
const LABEL = 'text-fg-muted'
const VALUE = 'text-right num'
const HEADING = 'mt-1 text-2xs text-fg-subtle'

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

const UPGRADE_LABELS: Readonly<Record<keyof SkillMarks, string>> = {
  evolution: '개화',
  enhancement: '강화'
}

function UpgradeRows({
  kind,
  rates,
  names,
  marks
}: {
  kind: keyof SkillMarks
  rates: SkillUpgradeRates
  names: readonly [string, string]
  marks: SkillMarks
}): React.JSX.Element {
  return (
    <>
      <span className={HEADING}>{UPGRADE_LABELS[kind]}</span>
      <span className={ROWS}>
        {UPGRADE_TYPES.map((type, index) => (
          <Fragment key={type}>
            <span className="inline-flex items-center gap-2">
              <img
                src={skillMarkOf(marks, kind, type)}
                alt={kind === 'evolution' ? EVOLUTION_NUMERALS[type] : ''}
                className={`${kind === 'evolution' ? 'size-[17px]' : 'size-[18px]'} ${PIXELATED}`}
              />
              {names[index]}
            </span>
            <span className={VALUE}>{formatRate(rates[index])}</span>
          </Fragment>
        ))}
      </span>
    </>
  )
}

function sampleText(sampleSize: number, role: MaleCrusaderRole | null): string {
  const sample = `표본 ${integer.format(sampleSize)}명`
  if (role === null) {
    return sample
  }

  return `${MALE_CRUSADER_ROLE_LABELS[role]} ${sample}`
}

export function SkillAdoptionTooltip({
  name,
  adoption,
  role,
  marks,
  now
}: {
  name: string
  adoption: SkillAdoption
  role: MaleCrusaderRole | null
  marks: SkillMarks
  now: number
}): React.JSX.Element {
  const { levels, evolution, enhancement } = adoption

  return (
    // 시안의 Tooltip은 위아래 8px이라 공통 Tooltip 틀(4px)에 4px을 더한다. 최소 폭 200px에서 좌우 여백 24px을 뺀 176px이다.
    <span className="flex min-w-[176px] flex-col gap-1 py-1 text-xs">
      <span className="text-sm font-semibold">{name}</span>
      <span className={ROWS}>
        <span className={LABEL}>채택률</span>
        <span className={VALUE}>{formatRate(adoption.adoption)}</span>
      </span>
      {levels !== null && (
        <>
          <span className={HEADING}>레벨</span>
          <span className={ROWS}>
            <span className={LABEL}>상위 50%</span>
            <span className={VALUE}>{levels.p50}</span>
            <span className={LABEL}>상위 5%</span>
            <span className={VALUE}>{levels.p95}</span>
          </span>
        </>
      )}
      {evolution !== null && (
        <UpgradeRows
          kind="evolution"
          rates={evolution.rates}
          names={evolution.names}
          marks={marks}
        />
      )}
      {enhancement !== null && (
        <UpgradeRows
          kind="enhancement"
          rates={enhancement}
          names={[ENHANCEMENT_LABELS[1], ENHANCEMENT_LABELS[2]]}
          marks={marks}
        />
      )}
      <span className="mt-1 flex justify-between gap-4 border-t border-line pt-2 text-2xs text-fg-subtle tabular-nums">
        <span>{sampleText(adoption.sampleSize, role)}</span>
        {adoption.computedAt !== null && (
          <span>{formatSeoulDateTime(adoption.computedAt, now)}</span>
        )}
      </span>
    </span>
  )
}

export type SkillAdoptionSource = Readonly<{
  stats: SkillStats | null
  role: MaleCrusaderRole | null
  marks: SkillMarks
  now: number
}>

export type SkillAdoptionSkill = Readonly<{
  name: string
  evolutionNames: readonly [string, string] | null
  enhanceable: boolean
}>

function adoptionOf(
  { stats, role }: SkillAdoptionSource,
  skill: SkillAdoptionSkill
): SkillAdoption | null {
  if (stats === null || (role !== null && skill.name === MALE_CRUSADER_DEALER_SKILL)) {
    return null
  }

  return skillAdoptionOf(stats, {
    name: skill.name,
    evolutionNames: skill.evolutionNames,
    hasEnhancement: skill.enhanceable
  })
}

export function SkillAdoptionHover({
  skill,
  source,
  trigger,
  side,
  children
}: {
  skill: SkillAdoptionSkill
  source: SkillAdoptionSource
  trigger: React.ReactElement
  side?: TooltipPopupProps['side']
  children: React.ReactNode
}): React.JSX.Element {
  const adoption = adoptionOf(source, skill)

  return (
    // Tooltip이 옆 스킬과 아래 행을 덮으므로, 마우스가 Tooltip으로 옮겨 가면 닫아 다른 스킬을 볼 수 있게 한다.
    <Tooltip.Root disableHoverablePopup>
      <Tooltip.Trigger delay={0} closeDelay={0} render={trigger}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Popup side={side}>
        {adoption !== null ? (
          <SkillAdoptionTooltip
            name={skill.name}
            adoption={adoption}
            role={source.role}
            marks={source.marks}
            now={source.now}
          />
        ) : (
          <span className={SKILL_TOOLTIP}>{skill.name}</span>
        )}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
