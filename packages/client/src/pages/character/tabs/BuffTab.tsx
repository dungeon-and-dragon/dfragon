import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { buffSkillInfoOf } from '@dfragon/client-core/shared/search/character-detail-display'
import {
  buffSkillIconOf,
  type SkillIconImage
} from '@dfragon/client-core/shared/search/skill-window'
import { useSkillWindowCatalog } from '../../../hooks/useSkillWindowCatalog'
import { BuffGearTable } from './buff/BuffGearTable'
import { styles } from './buff/BuffTab.style'
import type { CharacterTabProps } from './character-tab-props'
import { styles as partStyles } from './equipment/item-parts.style'
import { styles as tableStyles } from './equipment/item-table.style'
import { SkillSprite } from './skill/SkillSprite'
import { styles as skillStyles } from './skill/SkillTab.style'

export function BuffTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { buff } = detail
  const skillInfo = buffSkillInfoOf(buff)
  const equipment = buff.equipment?.equipment ?? []
  const avatars = buff.avatar?.avatar ?? []
  const creatures = (buff.creature?.creature ?? []).filter(({ itemName }) => itemName != null)
  const icon = useBuffSkillIcon(detail, skillInfo?.name ?? null)

  return (
    <div {...stylex.props(tableStyles.root)}>
      {skillInfo?.name != null && (
        <BuffSkill name={skillInfo.name} icon={icon} option={skillInfo.option} />
      )}
      {(equipment.length > 0 || avatars.length > 0 || creatures.length > 0) && (
        <section aria-label="버프 강화 장비, 아바타, 크리쳐">
          <h3 {...stylex.props(tableStyles.heading)}>장비, 아바타, 크리쳐</h3>
          <BuffGearTable equipment={equipment} avatars={avatars} creatures={creatures} />
        </section>
      )}
    </div>
  )
}

type BuffSkillOption = NonNullable<ReturnType<typeof buffSkillInfoOf>>['option']

function useBuffSkillIcon(
  { character }: CharacterTabProps['detail'],
  skillName: string | null
): SkillIconImage | null {
  const catalog = useSkillWindowCatalog()
  if (skillName === null || catalog.status !== 'success' || catalog.value === null) {
    return null
  }

  return buffSkillIconOf(catalog.value, character, skillName)
}

function BuffSkillName({
  name,
  icon
}: {
  name: string
  icon: SkillIconImage | null
}): React.JSX.Element {
  if (icon === null) {
    return <h2 {...stylex.props(styles.skillName)}>{name}</h2>
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={<h2 {...stylex.props(styles.skillName)} />}>
        <SkillSprite icon={icon} label={name} />
      </Tooltip.Trigger>
      <Tooltip.Popup>
        <span {...stylex.props(skillStyles.tooltip)}>{name}</span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function BuffSkill({
  name,
  icon,
  option
}: {
  name: string
  icon: SkillIconImage | null
  option: BuffSkillOption
}): React.JSX.Element {
  return (
    <section aria-label="버프 스킬">
      <div {...stylex.props(partStyles.strip)}>
        <span {...stylex.props(partStyles.stripLabel)}>버프 스킬</span>
        <BuffSkillName name={name} icon={icon} />
        {option?.level != null && (
          <span {...stylex.props(partStyles.stripMuted)}>{`Lv.${option.level}`}</span>
        )}
      </div>
    </section>
  )
}
