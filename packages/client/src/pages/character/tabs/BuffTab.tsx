import * as stylex from '@stylexjs/stylex'
import { toItemView } from '@dfragon/client-core/lib/character-item'
import {
  buffOptionLines,
  buffSkillInfoOf
} from '@dfragon/client-core/shared/search/character-detail-display'
import { BuffGearTable } from './buff/BuffGearTable'
import { styles } from './buff/BuffTab.style'
import type { CharacterTabProps } from './character-tab-props'
import { styles as partStyles } from './equipment/item-parts.style'
import { styles as tableStyles } from './equipment/item-table.style'
import { SlotItemTable } from './equipment/SlotItemTable'

export function BuffTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { buff } = detail
  const skillInfo = buffSkillInfoOf(buff)
  const equipment = buff.equipment?.equipment ?? []
  const avatars = buff.avatar?.avatar ?? []
  const creatures = buff.creature?.creature ?? []

  return (
    <div {...stylex.props(tableStyles.root)}>
      {skillInfo?.name != null && <BuffSkill name={skillInfo.name} option={skillInfo.option} />}
      {(equipment.length > 0 || avatars.length > 0) && (
        <section aria-label="버프 강화 장비, 아바타">
          <h3 {...stylex.props(tableStyles.heading)}>장비, 아바타</h3>
          <BuffGearTable equipment={equipment} avatars={avatars} />
        </section>
      )}
      {creatures.length > 0 && (
        <section aria-label="버프 강화 크리쳐">
          <h3 {...stylex.props(tableStyles.heading)}>크리쳐</h3>
          <SlotItemTable
            itemLabel="크리쳐"
            rows={creatures.flatMap((creature, index) => {
              if (creature.itemName == null) {
                return []
              }

              const key = creature.itemId ?? String(index)

              return [{ key, slot: '크리쳐', item: toItemView(creature) }]
            })}
          />
        </section>
      )}
    </div>
  )
}

type BuffSkillOption = NonNullable<ReturnType<typeof buffSkillInfoOf>>['option']

function BuffSkill({ name, option }: { name: string; option: BuffSkillOption }): React.JSX.Element {
  return (
    <section aria-label="버프 스킬">
      <div {...stylex.props(partStyles.strip)}>
        <span {...stylex.props(partStyles.stripLabel)}>버프 스킬</span>
        <h2 {...stylex.props(styles.skillName)}>{name}</h2>
        {option?.level != null && (
          <span {...stylex.props(partStyles.stripMuted)}>{`Lv.${option.level}`}</span>
        )}
      </div>
      {option != null && (
        <ul {...stylex.props(styles.optionLines)}>
          {buffOptionLines(option).map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
