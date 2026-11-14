import { ProgressCircle } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import {
  isMaleCrusaderJob,
  type MaleCrusaderRole,
  maleCrusaderRoleOf
} from '#core/character/male-crusader'
import type { SkillStats, SkillStatsJob } from '#core/ranking/skill-stats'
import {
  type LearnedSkillRow,
  learnedSkillRowsOf,
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
} from '#core/catalog/skill-window'
import type { LoadedResult } from '../../../hooks/useLoadedResult'
import { useSkillStats } from '../hooks/useSkillStats'
import { useSkillWindowCatalog } from '../hooks/useSkillWindowCatalog'
import type { CharacterTabProps } from './character-tab-props'
import { styles as layout } from './avatar/detail-tab.style'
import { type SkillAdoptionSource, SkillAdoptionHover } from './skill/SkillAdoptionTooltip'
import { SkillChainSection, SkillTreeCode, SkillUpgradeSections } from './skill/SkillSide'
import { styles as sideStyles } from './skill/SkillSide.style'
import { SkillSprite } from './skill/SkillSprite'
import { styles } from './skill/SkillTab.style'

const COMMON_ROW = 0

function SkillIcon({
  icon,
  source
}: {
  icon: SkillWindowIcon
  source: SkillAdoptionSource
}): React.JSX.Element {
  const picked = icon.evolution !== null || icon.enhancement !== null

  return (
    <SkillAdoptionHover
      skill={icon}
      source={source}
      trigger={
        <span
          data-skill-id={icon.skillId}
          {...stylex.props(styles.icon, styles.iconPosition(icon.col, icon.row))}
        />
      }
    >
      <span {...stylex.props(styles.frame, picked && styles.picked)}>
        <SkillSprite icon={icon.icon} label={icon.name} dim={!icon.learned} />
        {icon.evolution !== null && (
          <img
            src={skillMarkOf(source.marks, 'evolution', icon.evolution)}
            alt=""
            draggable={false}
            {...stylex.props(styles.evolutionMark, styles.scaledMark)}
          />
        )}
        {icon.enhancement !== null && (
          <img
            src={skillMarkOf(source.marks, 'enhancement', icon.enhancement)}
            alt=""
            draggable={false}
            {...stylex.props(styles.enhancementMark, styles.scaledMark)}
          />
        )}
      </span>
      <span {...stylex.props(styles.level)}>
        {icon.learned && icon.level !== null ? `Lv ${icon.level}` : ''}
      </span>
    </SkillAdoptionHover>
  )
}

function SkillWindowGrid({
  skillWindow,
  source
}: {
  skillWindow: SkillWindow
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.windowColumn)}>
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
        {skillWindow.icons.map((icon) => (
          <SkillIcon key={`${icon.col},${icon.row}`} icon={icon} source={source} />
        ))}
      </div>
    </div>
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
                  <span {...stylex.props(styles.subtle, styles.unselectable)}>
                    {`Lv ${skill.level}`}
                  </span>
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

function skillStatsJobOf({ character, card }: CharacterDetailView): SkillStatsJob | null {
  const { jobId, jobGrowId } = character

  if (jobId === null || jobGrowId === null) {
    return null
  }

  const role = isMaleCrusaderJob({ jobId, jobGrowId })
    ? maleCrusaderRoleOf(character, card?.role ?? null)
    : null

  return { jobId, jobGrowId, role }
}

function SkillSideColumn({
  detail,
  style,
  catalog,
  source
}: CharacterTabProps & {
  style: SkillStyle
  catalog: SkillWindowCatalog | null
  source: SkillAdoptionSource | null
}): React.JSX.Element {
  const hash = detail.skillStyle?.hash ?? null
  const board = catalog !== null ? skillUpgradeBoardOf(catalog, detail.character, style) : null

  return (
    <div {...stylex.props(sideStyles.side)}>
      {hash !== null && <SkillTreeCode hash={hash} />}
      <SkillChainSection chain={skillChainOf(catalog, detail.character, style)} />
      {board !== null && source !== null ? (
        <SkillUpgradeSections board={board} source={source} />
      ) : (
        <div {...stylex.props(sideStyles.fallback)}>
          <SkillUpgrades label="스킬 개화" upgrades={skillUpgradesOf(style, 'evolution')} />
          <SkillUpgrades label="스킬 강화" upgrades={skillUpgradesOf(style, 'enhancement')} />
        </div>
      )}
    </div>
  )
}

type SkillColumnsProps = CharacterTabProps & {
  style: SkillStyle
  catalog: SkillWindowCatalog | null
  skillWindow: SkillWindow | null
}

function SkillColumns({
  detail,
  style,
  catalog,
  skillWindow,
  stats,
  role
}: SkillColumnsProps & {
  stats: SkillStats | null
  role: MaleCrusaderRole | null
}): React.JSX.Element {
  const [now] = useState(Date.now)
  const source = catalog !== null ? { stats, role, marks: catalog.marks, now } : null

  return (
    <div {...stylex.props(styles.root)}>
      {skillWindow !== null && source !== null ? (
        <SkillWindowGrid skillWindow={skillWindow} source={source} />
      ) : (
        <LearnedSkillRows rows={learnedSkillRowsOf([...style.active, ...style.passive])} />
      )}
      <SkillSideColumn detail={detail} style={style} catalog={catalog} source={source} />
    </div>
  )
}

function SkillColumnsWithStats({
  job,
  ...props
}: SkillColumnsProps & { job: SkillStatsJob }): React.JSX.Element {
  const stats = useSkillStats(job)

  return (
    <SkillColumns
      {...props}
      stats={stats.status === 'success' ? stats.value : null}
      role={job.role}
    />
  )
}

export function SkillTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  const catalog = useSkillWindowCatalog(detail.character.jobName)
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

  const loaded = loadedCatalog(catalog)
  const skillWindow = loaded !== null ? skillWindowOf(loaded, detail.character, style) : null
  const job = skillWindow !== null ? skillStatsJobOf(detail) : null

  if (job === null) {
    return (
      <SkillColumns
        detail={detail}
        style={style}
        catalog={loaded}
        skillWindow={skillWindow}
        stats={null}
        role={null}
      />
    )
  }

  return (
    <SkillColumnsWithStats
      detail={detail}
      style={style}
      catalog={loaded}
      skillWindow={skillWindow}
      job={job}
    />
  )
}
