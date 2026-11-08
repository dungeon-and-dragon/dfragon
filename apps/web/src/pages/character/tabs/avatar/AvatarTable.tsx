import * as stylex from '@stylexjs/stylex'
import { toItemView } from '#core/lib/character-item'
import { avatarSlotLabel } from '#core/shared/search/character-detail-display'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import { ItemIcon, ItemName } from '../equipment/item-parts'
import { styles as partStyles } from '../equipment/item-parts.style'
import { styles as tableStyles } from '../equipment/item-table.style'
import { styles } from './AvatarTable.style'

type Avatar = CharacterDetailView['avatar'][number]

export function AvatarTable({ avatars }: { avatars: readonly Avatar[] }): React.JSX.Element {
  const aura = avatars.find((avatar) => avatar.slotId === 'AURORA')
  const auraSkin = avatars.find((avatar) => avatar.slotId === 'AURA_SKIN')

  return (
    <table {...stylex.props(tableStyles.table)}>
      <thead>
        <tr>
          <th scope="col" {...stylex.props(tableStyles.head, tableStyles.first, styles.slotColumn)}>
            부위
          </th>
          <th scope="col" {...stylex.props(tableStyles.head)}>
            아바타
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
        {avatars.map((avatar, index) => {
          if (avatar.slotId === 'AURA_SKIN' && aura != null) {
            return null
          }

          const showsAuraSkinAsClone =
            avatar.slotId === 'AURORA' && avatar.clone?.itemId == null && auraSkin != null
          const displayedAvatar = showsAuraSkinAsClone
            ? { ...avatar, clone: { itemId: auraSkin.itemId, itemName: auraSkin.itemName } }
            : avatar

          return <AvatarRow key={avatar.slotId ?? index} avatar={displayedAvatar} />
        })}
      </tbody>
    </table>
  )
}

export function AvatarRow({
  avatar,
  cloneIconSpace = true
}: {
  avatar: Avatar
  cloneIconSpace?: boolean
}): React.JSX.Element {
  const item = toItemView(avatar)
  const cloneId = avatar.clone?.itemId ?? null
  const cloneName = avatar.clone?.itemName ?? null

  return (
    <tr {...stylex.props(tableStyles.row)}>
      <td {...stylex.props(tableStyles.cell, tableStyles.first, tableStyles.slot)}>
        {avatarSlotLabel(avatar.slotName)}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        <div {...stylex.props(partStyles.item)}>
          <span {...stylex.props(styles.icons)}>
            <ItemIcon itemId={item.itemId} rarity={item.rarity} />
            {cloneId != null && <ItemIcon itemId={cloneId} rarity={null} />}
            {cloneId == null && cloneIconSpace && (
              <span aria-hidden="true" {...stylex.props(partStyles.iconSpace)} />
            )}
          </span>
          <span {...stylex.props(styles.names)}>
            <span {...stylex.props(styles.name)}>
              <ItemName name={item.itemName} rarity={item.rarity} />
            </span>
            {cloneName != null && (
              <span title={cloneName} {...stylex.props(styles.clone)}>
                {cloneName}
              </span>
            )}
          </span>
        </div>
      </td>
      <td {...stylex.props(tableStyles.cell)}>{avatar.optionAbility}</td>
      <td {...stylex.props(tableStyles.cell, tableStyles.last)}>
        <span {...stylex.props(styles.stack)}>
          {avatar.emblems.map((emblem, index) => {
            if (emblem.itemName == null) {
              return null
            }

            const { itemName, rarity } = toItemView(emblem)

            return <ItemName key={emblem.slotNo ?? index} name={itemName} rarity={rarity} />
          })}
        </span>
      </td>
    </tr>
  )
}
