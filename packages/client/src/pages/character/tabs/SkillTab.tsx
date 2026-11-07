import { ProgressCircle, Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import {
  type SkillAdoption,
  type SkillStats,
  type SkillStatsJob,
  skillAdoptionOf
} from '@dfragon/client-core/shared/ranking/skill-stats'
import {
  type LearnedSkillRow,
  learnedSkillRowsOf,
  type SkillMarks,
  type SkillStyle,
  type SkillUpgrade,
  type SkillWindow,
  type SkillWindowCatalog,
  type SkillWindowIcon,
  skillChainOf,
  skillMarkOf,
  skillUpgradeBoardOf,
  skillUpgradesOf,
  skillWindowOf
} from '@dfragon/client-core/shared/search/skill-window'
import type { LoadedResult } from '../../../hooks/useLoadedResult'
import { useSkillStats } from '../../../hooks/useSkillStats'
import { useSkillWindowCatalog } from '../../../hooks/useSkillWindowCatalog'
import type { CharacterTabProps } from './character-tab-props'
import { styles as layout } from './avatar/detail-tab.style'
import { SkillAdoptionTooltip } from './skill/SkillAdoptionTooltip'
import { SkillChainSection, SkillTreeCode, SkillUpgradeSections } from './skill/SkillSide'
import { styles as sideStyles } from './skill/SkillSide.style'
import { SkillSprite } from './skill/SkillSprite'
import { styles } from './skill/SkillTab.style'

const COMMON_ROW = 0

function SkillIcon({
  icon,
  marks,
  adoption,
  now
}: {
  icon: SkillWindowIcon
  marks: SkillMarks | null
  adoption: SkillAdoption | null
  now: number
}): React.JSX.Element {
  const picked = icon.evolution !== null || icon.enhancement !== null

  return (
    <Tooltip.Root disableHoverablePopup>
      <Tooltip.Trigger
        delay={0}
        closeDelay={0}
        render={
          <span
            data-skill-id={icon.skillId}
            {...stylex.props(styles.icon, styles.iconPosition(icon.col, icon.row))}
          />
        }
      >
        <span {...stylex.props(styles.frame, picked && styles.picked)}>
          <SkillSprite icon={icon.icon} label={icon.name} dim={!icon.learned} />
          {marks !== null && icon.evolution !== null && (
            <img
              src={skillMarkOf(marks, 'evolution', icon.evolution)}
              alt=""
              {...stylex.props(styles.evolutionMark)}
            />
          )}
          {marks !== null && icon.enhancement !== null && (
            <img
              src={skillMarkOf(marks, 'enhancement', icon.enhancement)}
              alt=""
              {...stylex.props(styles.enhancementMark)}
            />
          )}
        </span>
        <span {...stylex.props(styles.level)}>
          {icon.learned && icon.level !== null ? `Lv ${icon.level}` : ''}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Popup>
        {adoption !== null ? (
          <SkillAdoptionTooltip name={icon.name} adoption={adoption} marks={marks} now={now} />
        ) : (
          <span {...stylex.props(styles.tooltip)}>{icon.name}</span>
        )}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function SkillWindowGrid({
  skillWindow,
  stats
}: {
  skillWindow: SkillWindow
  stats: SkillStats | null
}): React.JSX.Element {
  const [now] = useState(Date.now)

  return (
    <div
      role="group"
      aria-label="스킬 창"
      {...stylex.props(styles.window, styles.windowSize(skillWindow.rows.length))}
    >
      {skillWindow.rows.map(({ row, requiredLevel }) => (
        <div key={row}>
          {row > COMMON_ROW && <div {...stylex.props(styles.rowLine, styles.rowTop(row))} />}
          <span {...stylex.props(styles.rowLabel, styles.rowTop(row))}>
            {row === COMMON_ROW ? '공용' : requiredLevel}
          </span>
        </div>
      ))}
      {skillWindow.icons.map((icon) => {
        const adoption =
          stats !== null
            ? skillAdoptionOf(stats, {
                name: icon.name,
                evolutionNames: icon.evolutionNames,
                hasEnhancement: icon.enhanceable
              })
            : null

        return (
          <SkillIcon
            key={`${icon.col},${icon.row}`}
            icon={icon}
            marks={skillWindow.marks}
            adoption={adoption}
            now={now}
          />
        )
      })}
    </div>
  )
}

function SkillWindowWithStats({
  skillWindow,
  job
}: {
  skillWindow: SkillWindow
  job: SkillStatsJob
}): React.JSX.Element {
  const stats = useSkillStats(job)

  return (
    <SkillWindowGrid
      skillWindow={skillWindow}
      stats={stats.status === 'success' ? stats.value : null}
    />
  )
}

function LearnedSkillRows({ rows }: { rows: readonly LearnedSkillRow[] }): React.JSX.Element {
  return (
    <div aria-label="배운 스킬" {...stylex.props(styles.levelRows)}>
      {rows.map(({ requiredLevel, skills }) => (
        <section key={requiredLevel ?? 'none'} {...stylex.props(layout.section)}>
          <h3 {...stylex.props(layout.heading)}>
            {requiredLevel !== null ? `${requiredLevel}레벨` : '습득 레벨 없음'}
          </h3>
          <ul {...stylex.props(styles.list)}>
            {skills.map((skill, index) => (
              <li key={skill.skillId ?? index} {...stylex.props(styles.listRow)}>
                <span>{skill.name}</span>
                {skill.level !== null && (
                  <span {...stylex.props(styles.subtle)}>{`Lv ${skill.level}`}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function SkillUpgrades({
  label,
  upgrades
}: {
  label: string
  upgrades: readonly SkillUpgrade[]
}): React.JSX.Element | null {
  if (upgrades.length === 0) {
    return null
  }

  return (
    <section aria-label={label} {...stylex.props(layout.section)}>
      <h3 {...stylex.props(layout.heading)}>{label}</h3>
      <ul {...stylex.props(styles.list)}>
        {upgrades.map((upgrade, index) => (
          <li key={upgrade.skillId ?? index} {...stylex.props(styles.listRow)}>
            <span>{upgrade.name ?? upgrade.skillId}</span>
            <span {...stylex.props(styles.subtle)}>{upgrade.type}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function loadedCatalog(
  catalog: LoadedResult<SkillWindowCatalog | null>
): SkillWindowCatalog | null {
  if (catalog.status !== 'success') {
    return null
  }

  return catalog.value
}

function LearnedSkills({
  detail,
  style,
  catalog
}: CharacterTabProps & {
  style: SkillStyle
  catalog: SkillWindowCatalog | null
}): React.JSX.Element {
  const skillWindow = catalog !== null ? skillWindowOf(catalog, detail.character, style) : null
  if (skillWindow === null) {
    return <LearnedSkillRows rows={learnedSkillRowsOf([...style.active, ...style.passive])} />
  }

  const { jobId, jobGrowId } = detail.character
  if (jobId === null || jobGrowId === null) {
    return <SkillWindowGrid skillWindow={skillWindow} stats={null} />
  }

  return <SkillWindowWithStats skillWindow={skillWindow} job={{ jobId, jobGrowId }} />
}

function SkillSideColumn({
  detail,
  style,
  catalog
}: CharacterTabProps & {
  style: SkillStyle
  catalog: SkillWindowCatalog | null
}): React.JSX.Element {
  const hash = detail.skillStyle?.hash ?? null
  const board = catalog !== null ? skillUpgradeBoardOf(catalog, detail.character, style) : null

  return (
    <div {...stylex.props(sideStyles.side)}>
      {hash !== null && <SkillTreeCode hash={hash} />}
      <SkillChainSection chain={skillChainOf(catalog, detail.character, style)} />
      {board !== null ? (
        <SkillUpgradeSections board={board} />
      ) : (
        <div {...stylex.props(sideStyles.fallback)}>
          <SkillUpgrades label="스킬 개화" upgrades={skillUpgradesOf(style, 'evolution')} />
          <SkillUpgrades label="스킬 강화" upgrades={skillUpgradesOf(style, 'enhancement')} />
        </div>
      )}
    </div>
  )
}

export function SkillTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  const catalog = useSkillWindowCatalog()
  const style = detail.skillStyle?.style
  if (style == null) {
    return null
  }

  if (catalog.status === 'loading') {
    return (
      <div aria-busy="true" {...stylex.props(styles.root)}>
        <div {...stylex.props(styles.state)}>
          <ProgressCircle size="24" tone="neutral" aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div {...stylex.props(styles.root)}>
      <LearnedSkills detail={detail} style={style} catalog={loadedCatalog(catalog)} />
      <SkillSideColumn detail={detail} style={style} catalog={loadedCatalog(catalog)} />
    </div>
  )
}
