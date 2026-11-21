import { Tooltip } from '@dfragon/ui'
import { buffSkillInfoOf } from '#entities/character'
import {
  buffSkillIconOf,
  type SkillIconImage,
  SkillSprite,
  useSkillWindowCatalog
} from '#entities/catalog'
import { BuffGearTable } from './buff/BuffGearTable'
import type { CharacterTabProps } from './character-tab-props'
import { itemClasses, itemTableClasses } from './equipment/item-classes'
import { SKILL_TOOLTIP } from './skill/skill-classes'

const SKILL_NAME = 'm-0 text-sm font-semibold'

export function BuffTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { buff } = detail
  const skillInfo = buffSkillInfoOf(buff)
  const equipment = buff.equipment?.equipment ?? []
  const avatars = buff.avatar?.avatar ?? []
  const creatures = (buff.creature?.creature ?? []).filter(({ itemName }) => itemName != null)
  const icon = useBuffSkillIcon(detail, skillInfo?.name ?? null)

  return (
    <div className={itemTableClasses.root}>
      {skillInfo?.name != null && (
        <BuffSkill name={skillInfo.name} icon={icon} option={skillInfo.option} />
      )}
      {(equipment.length > 0 || avatars.length > 0 || creatures.length > 0) && (
        <section aria-label="버프 강화 장비, 아바타, 크리쳐">
          <h3 className={itemTableClasses.heading}>장비, 아바타, 크리쳐</h3>
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
  const catalog = useSkillWindowCatalog(character.jobName)
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
    return <h2 className={SKILL_NAME}>{name}</h2>
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={<h2 className={SKILL_NAME} />}>
        <SkillSprite icon={icon} label={name} />
      </Tooltip.Trigger>
      <Tooltip.Popup>
        <span className={SKILL_TOOLTIP}>{name}</span>
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
      <div className={itemClasses.strip}>
        <span className="label">버프 스킬</span>
        <BuffSkillName name={name} icon={icon} />
        {option?.level != null && (
          <span className={itemClasses.stripNumber}>{`Lv ${option.level}`}</span>
        )}
      </div>
    </section>
  )
}
