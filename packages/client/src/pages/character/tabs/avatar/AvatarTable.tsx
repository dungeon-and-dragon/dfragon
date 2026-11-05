import * as stylex from '@stylexjs/stylex'
import { avatarSlotLabel } from '@dfragon/client-core/shared/search/character-detail-display'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { styles } from './detail-tab.style'
import { ItemName } from './ItemName'

type Avatar = CharacterDetailView['avatar'][number]

export function AvatarTable({ avatars }: { avatars: readonly Avatar[] }): React.JSX.Element {
  return (
    <table {...stylex.props(styles.table)}>
      <thead>
        <tr>
          {['부위', '아바타', '옵션', '엠블렘'].map((label) => (
            <th key={label} scope="col" {...stylex.props(styles.headCell)}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {avatars.map((avatar, index) => (
          <AvatarRow key={avatar.slotId ?? index} avatar={avatar} />
        ))}
      </tbody>
    </table>
  )
}

function AvatarRow({ avatar }: { avatar: Avatar }): React.JSX.Element {
  const cloneName = avatar.clone?.itemName ?? null

  return (
    <tr>
      <td {...stylex.props(styles.cell, styles.slot)}>{avatarSlotLabel(avatar.slotName)}</td>
      <td {...stylex.props(styles.cell)}>
        <div {...stylex.props(styles.stack)}>
          {avatar.itemName != null && (
            <ItemName name={avatar.itemName} rarity={avatar.itemRarity} />
          )}
          {cloneName != null && <span {...stylex.props(styles.clone)}>{cloneName}</span>}
        </div>
      </td>
      <td {...stylex.props(styles.cell)}>{avatar.optionAbility}</td>
      <td {...stylex.props(styles.cell)}>
        <div {...stylex.props(styles.stack)}>
          {avatar.emblems.map(
            (emblem, index) =>
              emblem.itemName != null && (
                <ItemName
                  key={emblem.slotNo ?? index}
                  name={emblem.itemName}
                  rarity={emblem.itemRarity}
                />
              )
          )}
        </div>
      </td>
    </tr>
  )
}
