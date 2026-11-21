import {
  type CharacterDetailView,
  type ItemView,
  signedEnchantValue,
  toItemView
} from '#entities/character'
import { AvatarRow } from '#pages/character/tabs/avatar/AvatarTable'
import { avatarClasses } from '#pages/character/tabs/avatar/avatar-classes'
import { itemTableClasses } from '#pages/character/tabs/equipment/item-classes'
import { ItemCell } from '#pages/character/tabs/equipment/item-parts'

type Buff = CharacterDetailView['buff']
type BuffEquipment = NonNullable<Buff['equipment']>['equipment'][number]
type BuffAvatar = NonNullable<Buff['avatar']>['avatar'][number]
type BuffCreature = NonNullable<Buff['creature']>['creature'][number]

const { slot: slotCell } = itemTableClasses

export function BuffGearTable({
  equipment,
  avatars,
  creatures
}: {
  equipment: readonly BuffEquipment[]
  avatars: readonly BuffAvatar[]
  creatures: readonly BuffCreature[]
}): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table table-wrap min-w-[800px] max-sm:min-w-0">
        <thead>
          <tr>
            <th scope="col" className={`${avatarClasses.slotColumn} max-sm:hidden`}>
              부위
            </th>
            <th scope="col">아이템</th>
            <th scope="col" className={`${avatarClasses.optionColumn}`}>
              옵션
            </th>
            <th scope="col" className={`${avatarClasses.emblemColumn}`}>
              엠블렘
            </th>
          </tr>
        </thead>
        <tbody>
          {equipment.map((item, index) => (
            <ItemRow
              key={`equipment-${item.slotId ?? index}`}
              slot={item.slotName}
              item={toItemView(item)}
              enchant={item.enchant}
            />
          ))}
          {avatars.map((avatar, index) => (
            <AvatarRow
              key={`avatar-${avatar.slotId ?? index}`}
              avatar={avatar}
              cloneIconSpace={false}
            />
          ))}
          {creatures.map((creature, index) => (
            <ItemRow
              key={`creature-${creature.itemId ?? index}`}
              slot="크리쳐"
              item={toItemView(creature)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ItemRow({
  slot,
  item,
  enchant = null
}: {
  slot: string | null
  item: ItemView
  enchant?: BuffEquipment['enchant']
}): React.JSX.Element {
  const skillLines = (enchant?.reinforceSkill ?? []).flatMap(({ skills }) =>
    skills.flatMap(({ name, value }) =>
      name != null && value != null ? [`${name} 스킬Lv ${signedEnchantValue(value)}`] : []
    )
  )
  const statusLines = (enchant?.status ?? []).flatMap(({ name, value }) =>
    name != null && value != null ? [`${name} ${signedEnchantValue(value)}`] : []
  )
  const lines = [...skillLines, ...statusLines]

  return (
    <tr>
      <td className={`${slotCell} max-sm:hidden`}>{slot}</td>
      <td>
        <ItemCell item={item} tune={null} />
      </td>
      <td>
        {lines.length > 0 && (
          <span className={avatarClasses.stack}>
            {lines.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </span>
        )}
      </td>
      <td />
    </tr>
  )
}
