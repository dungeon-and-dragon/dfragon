import { ProgressCircle, Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import {
  type LearnedSkillRow,
  learnedSkillRowsOf,
  type SkillStyle,
  type SkillUpgrade,
  type SkillWindow,
  type SkillWindowIcon,
  skillUpgradesOf,
  skillWindowOf
} from '@dfragon/client-core/shared/search/skill-window'
import { useSkillWindowCatalog } from '../../../hooks/useSkillWindowCatalog'
import type { CharacterTabProps } from './character-tab-props'
import { styles as layout } from './avatar/detail-tab.style'
import { styles } from './skill/SkillTab.style'

const COMMON_ROW = 0

function SkillIcon({ icon }: { icon: SkillWindowIcon }): React.JSX.Element {
  return (
    <Tooltip.Root>
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
        <span
          role="img"
          aria-label={icon.name}
          {...stylex.props(
            styles.image,
            styles.sprite(icon.icon.sprite, icon.icon.x, icon.icon.y),
            !icon.learned && styles.unlearned
          )}
        />
        <span {...stylex.props(styles.level)}>
          {icon.learned && icon.level !== null ? `Lv ${icon.level}` : ''}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Popup>
        <span {...stylex.props(styles.tooltip)}>{icon.name}</span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function SkillWindowGrid({ skillWindow }: { skillWindow: SkillWindow }): React.JSX.Element {
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
      {skillWindow.icons.map((icon) => (
        <SkillIcon key={`${icon.col},${icon.row}`} icon={icon} />
      ))}
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

function LearnedSkills({
  detail,
  style
}: CharacterTabProps & { style: SkillStyle }): React.JSX.Element {
  const catalog = useSkillWindowCatalog()
  if (catalog.status === 'loading') {
    return (
      <div aria-busy="true" {...stylex.props(styles.state)}>
        <ProgressCircle size="24" tone="neutral" aria-hidden="true" />
      </div>
    )
  }
  const skillWindow =
    catalog.status === 'success' && catalog.value !== null
      ? skillWindowOf(catalog.value, detail.character, style)
      : null
  if (skillWindow === null) {
    return <LearnedSkillRows rows={learnedSkillRowsOf([...style.active, ...style.passive])} />
  }

  return <SkillWindowGrid skillWindow={skillWindow} />
}

export function SkillTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  const style = detail.skillStyle?.style
  if (style == null) {
    return null
  }

  return (
    <div {...stylex.props(styles.root)}>
      <LearnedSkills detail={detail} style={style} />
      <div {...stylex.props(styles.side)}>
        <SkillUpgrades label="스킬 개화" upgrades={skillUpgradesOf(style, 'evolution')} />
        <SkillUpgrades label="스킬 강화" upgrades={skillUpgradesOf(style, 'enhancement')} />
      </div>
    </div>
  )
}
