import * as stylex from '@stylexjs/stylex'
import { toItemView } from '@dfragon/client-core/lib/character-item'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { styles } from '../avatar/AvatarTable.style'
import { AvatarRow } from '../avatar/AvatarTable'
import { ItemCell } from '../equipment/item-parts'
import { styles as tableStyles } from '../equipment/item-table.style'

type Buff = CharacterDetailView['buff']
type BuffEquipment = NonNullable<Buff['equipment']>['equipment'][number]
type BuffAvatar = NonNullable<Buff['avatar']>['avatar'][number]

export function BuffGearTable({
  equipment,
  avatars
}: {
  equipment: readonly BuffEquipment[]
  avatars: readonly BuffAvatar[]
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
          <tr key={`equipment-${item.slotId ?? index}`} {...stylex.props(tableStyles.row)}>
            <td {...stylex.props(tableStyles.cell, tableStyles.first, tableStyles.slot)}>
              {item.slotName}
            </td>
            <td {...stylex.props(tableStyles.cell)}>
              <ItemCell item={toItemView(item)} tune={null} exalted={false} />
            </td>
            <td {...stylex.props(tableStyles.cell)} />
            <td {...stylex.props(tableStyles.cell, tableStyles.last)} />
          </tr>
        ))}
        {avatars.map((avatar, index) => (
          <AvatarRow key={`avatar-${avatar.slotId ?? index}`} avatar={avatar} />
        ))}
      </tbody>
    </table>
  )
}
