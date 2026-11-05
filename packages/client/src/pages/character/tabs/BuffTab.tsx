import * as stylex from '@stylexjs/stylex'
import {
  buffOptionLines,
  buffSkillInfoOf
} from '@dfragon/client-core/shared/search/character-detail-display'
import { styles } from './buff/BuffTab.style'
import type { CharacterTabProps } from './character-tab-props'
import { AvatarTable } from './shared/AvatarTable'
import { ItemName } from './shared/ItemName'
import { styles as layout } from './shared/detail-tab.style'

export function BuffTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { buff } = detail
  const skillInfo = buffSkillInfoOf(buff)
  const equipment = buff.equipment?.equipment ?? []
  const avatars = buff.avatar?.avatar ?? []
  const creatures = buff.creature?.creature ?? []

  return (
    <div {...stylex.props(layout.tab)}>
      {skillInfo?.name != null && (
        <section aria-label="버프 스킬" {...stylex.props(styles.skill)}>
          <div {...stylex.props(styles.skillTitle)}>
            <h2 {...stylex.props(styles.skillName)}>{skillInfo.name}</h2>
            {skillInfo.option?.level != null && (
              <span {...stylex.props(styles.skillLevel)}>{`Lv.${skillInfo.option.level}`}</span>
            )}
          </div>
          {skillInfo.option != null && (
            <ul {...stylex.props(styles.optionLines)}>
              {buffOptionLines(skillInfo.option).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div {...stylex.props(styles.columns)}>
        {equipment.length > 0 && (
          <section aria-label="버프 강화 장비" {...stylex.props(layout.section, styles.equipment)}>
            <h3 {...stylex.props(layout.heading)}>장비</h3>
            <table {...stylex.props(layout.table)}>
              <tbody>
                {equipment.map((item, index) => (
                  <tr key={item.slotId ?? index}>
                    <td {...stylex.props(layout.cell, layout.slot)}>{item.slotName}</td>
                    <td {...stylex.props(layout.cell)}>
                      {item.itemName != null && (
                        <ItemName name={item.itemName} rarity={item.itemRarity} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <div {...stylex.props(styles.side)}>
          {avatars.length > 0 && (
            <section aria-label="버프 강화 아바타" {...stylex.props(layout.section)}>
              <h3 {...stylex.props(layout.heading)}>아바타</h3>
              <AvatarTable avatars={avatars} />
            </section>
          )}
          {creatures.length > 0 && (
            <section aria-label="버프 강화 크리쳐" {...stylex.props(layout.section)}>
              <h3 {...stylex.props(layout.heading)}>크리쳐</h3>
              <ul {...stylex.props(styles.creatures)}>
                {creatures.map(
                  (creature, index) =>
                    creature.itemName != null && (
                      <li key={creature.itemId ?? index}>
                        <ItemName name={creature.itemName} rarity={creature.itemRarity} />
                      </li>
                    )
                )}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
