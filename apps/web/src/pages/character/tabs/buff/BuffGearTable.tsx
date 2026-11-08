import * as stylex from '@stylexjs/stylex'
import { type ItemView, toItemView } from '#core/character/character-item'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { styles } from '../avatar/AvatarTable.style'
import { AvatarRow } from '../avatar/AvatarTable'
import { ItemCell } from '../equipment/item-parts'
import { styles as tableStyles } from '../equipment/item-table.style'

type Buff = CharacterDetailView['buff']
type BuffEquipment = NonNullable<Buff['equipment']>['equipment'][number]
type BuffAvatar = NonNullable<Buff['avatar']>['avatar'][number]
type BuffCreature = NonNullable<Buff['creature']>['creature'][number]

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
    <table {...stylex.props(tableStyles.table)}>
      <thead>
        <tr>
          <th scope="col" {...stylex.props(tableStyles.head, tableStyles.first, styles.slotColumn)}>
            부위
          </th>
          <th scope="col" {...stylex.props(tableStyles.head)}>
            아이템
          </th>
          <th scope="col" {...stylex.props(tableStyles.head, styles.optionColumn)}>
            옵션
          </th>
          <th
            scope="col"
            {...stylex.props(tableStyles.head, tableStyles.last, styles.emblemColumn)}
          >
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
  )
}

function ItemRow({ slot, item }: { slot: string | null; item: ItemView }): React.JSX.Element {
  return (
    <tr {...stylex.props(tableStyles.row)}>
      <td {...stylex.props(tableStyles.cell, tableStyles.first, tableStyles.slot)}>{slot}</td>
      <td {...stylex.props(tableStyles.cell)}>
        <ItemCell item={item} tune={null} exalted={false} />
      </td>
      <td {...stylex.props(tableStyles.cell)} />
      <td {...stylex.props(tableStyles.cell, tableStyles.last)} />
    </tr>
  )
}
