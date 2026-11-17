import { signedEnchantValue } from '#core/character/character-equipment'
import { type ItemView, toItemView } from '#core/character/character-item'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { AvatarRow } from '../avatar/AvatarTable'
import { avatarClasses } from '../avatar/avatar-classes'
import { itemTableClasses } from '../equipment/item-classes'
import { ItemCell } from '../equipment/item-parts'

type Buff = CharacterDetailView['buff']
type BuffEquipment = NonNullable<Buff['equipment']>['equipment'][number]
type BuffAvatar = NonNullable<Buff['avatar']>['avatar'][number]
type BuffCreature = NonNullable<Buff['creature']>['creature'][number]

const { scroll, table, head, body, row, cell, slot: slotCell } = itemTableClasses

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
    <div className={scroll}>
      <table className={`${table} min-w-200`}>
        <thead>
          <tr>
            <th scope="col" className={`${head} ${avatarClasses.slotColumn}`}>
              부위
            </th>
            <th scope="col" className={head}>
              아이템
            </th>
            <th scope="col" className={`${head} ${avatarClasses.optionColumn}`}>
              옵션
            </th>
            <th scope="col" className={`${head} ${avatarClasses.emblemColumn}`}>
              엠블렘
            </th>
          </tr>
        </thead>
        <tbody className={body}>
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
    <tr className={row}>
      <td className={`${cell} ${slotCell}`}>{slot}</td>
      <td className={cell}>
        <ItemCell item={item} tune={null} exalted={false} />
      </td>
      <td className={cell}>
        {lines.length > 0 && (
          <span className={avatarClasses.stack}>
            {lines.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </span>
        )}
      </td>
      <td className={cell} />
    </tr>
  )
}
