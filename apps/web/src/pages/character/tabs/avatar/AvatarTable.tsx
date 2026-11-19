import {
  avatarSlotLabel,
  type CharacterDetailView,
  ItemIcon,
  ItemName,
  toItemView
} from '#entities/character'
import { itemClasses, itemTableClasses } from '#pages/character/tabs/equipment/item-classes'
import { avatarClasses } from './avatar-classes'

type Avatar = CharacterDetailView['avatar'][number]

const { slot } = itemTableClasses

export function AvatarTable({ avatars }: { avatars: readonly Avatar[] }): React.JSX.Element {
  const aura = avatars.find((avatar) => avatar.slotId === 'AURORA')
  const auraSkin = avatars.find((avatar) => avatar.slotId === 'AURA_SKIN')

  return (
    <div className="table-scroll">
      <table className="table table-wrap min-w-[800px]">
        <thead>
          <tr>
            <th scope="col" className={`${avatarClasses.slotColumn}`}>
              부위
            </th>
            <th scope="col">아바타</th>
            <th scope="col" className={`${avatarClasses.optionColumn}`}>
              옵션
            </th>
            <th scope="col" className={`${avatarClasses.emblemColumn}`}>
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
    </div>
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
    <tr>
      <td className={`${slot}`}>{avatarSlotLabel(avatar.slotName)}</td>
      <td>
        <div className={itemClasses.item}>
          <span className="flex shrink-0 gap-1">
            <ItemIcon itemId={item.itemId} rarity={item.rarity} />
            {cloneId != null && <ItemIcon itemId={cloneId} rarity={null} />}
            {cloneId == null && cloneIconSpace && (
              <span aria-hidden="true" className={itemClasses.iconSpace} />
            )}
          </span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 whitespace-nowrap">
              <ItemName name={item.itemName} rarity={item.rarity} />
            </span>
            {cloneName != null && (
              <span title={cloneName} className={avatarClasses.clone}>
                {cloneName}
              </span>
            )}
          </span>
        </div>
      </td>
      <td>{avatar.optionAbility}</td>
      <td>
        <span className={avatarClasses.stack}>
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
