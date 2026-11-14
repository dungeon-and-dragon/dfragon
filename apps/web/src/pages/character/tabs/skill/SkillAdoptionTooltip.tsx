import { Tooltip, type TooltipPopupProps } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { Fragment } from 'react'
import { formatSeoulDateTime } from '#core/time-format'
import {
  MALE_CRUSADER_DEALER_SKILL,
  MALE_CRUSADER_ROLE_LABELS,
  type MaleCrusaderRole
} from '#core/character/male-crusader'
import {
  type SkillAdoption,
  type SkillStats,
  type SkillUpgradeRates,
  skillAdoptionOf
} from '#core/ranking/skill-stats'
import { type SkillMarks, skillMarkOf, type UpgradeType } from '#core/catalog/skill-window'
import { styles } from './SkillAdoptionTooltip.style'
import { styles as skillStyles } from './SkillTab.style'
import { ENHANCEMENT_LABELS, EVOLUTION_NUMERALS } from './upgrade-labels'

const UPGRADE_TYPES = [1, 2] as const satisfies readonly UpgradeType[]

const integer = new Intl.NumberFormat('ko-KR')

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
      <span {...stylex.props(styles.heading)}>{UPGRADE_LABELS[kind]}</span>
      <span {...stylex.props(styles.rows)}>
        {UPGRADE_TYPES.map((type, index) => (
          <Fragment key={type}>
            <span {...stylex.props(styles.branch)}>
              <img
                src={skillMarkOf(marks, kind, type)}
                alt={kind === 'evolution' ? EVOLUTION_NUMERALS[type] : ''}
                {...stylex.props(kind === 'evolution' ? styles.mark : styles.enhancementMark)}
              />
              {names[index]}
            </span>
            <span {...stylex.props(styles.value)}>{formatRate(rates[index])}</span>
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
    <span {...stylex.props(styles.root)}>
      <span {...stylex.props(styles.name)}>{name}</span>
      <span {...stylex.props(styles.rows)}>
        <span {...stylex.props(styles.label)}>채택률</span>
        <span {...stylex.props(styles.value)}>{formatRate(adoption.adoption)}</span>
      </span>
      {levels !== null && (
        <>
          <span {...stylex.props(styles.heading)}>레벨</span>
          <span {...stylex.props(styles.rows)}>
            <span {...stylex.props(styles.label)}>상위 50%</span>
            <span {...stylex.props(styles.value)}>{levels.p50}</span>
            <span {...stylex.props(styles.label)}>상위 5%</span>
            <span {...stylex.props(styles.value)}>{levels.p95}</span>
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
      <span {...stylex.props(styles.footer)}>
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
          <span {...stylex.props(skillStyles.tooltip)}>{skill.name}</span>
        )}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
