import {
  avatarSlotLabel,
  type CharacterDetailView,
  type ItemRarity,
  ItemIcon,
  ItemName,
  rarityTextClasses,
  toItemView
} from '#entities/character'
import { Fragment } from 'react'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { itemClasses, itemTableClasses } from '#pages/character/tabs/equipment/item-classes'
import { avatarClasses } from './avatar-classes'

type Avatar = CharacterDetailView['avatar'][number]

const { slot } = itemTableClasses
// 엠블렘 이름 끝 대괄호 안의 능력치(찬란한 붉은빛 엠블렘[힘]의 힘)다.
const EMBLEM_STAT = /\[([^\]]+)\]$/

export function AvatarTable({ avatars }: { avatars: readonly Avatar[] }): React.JSX.Element {
  const aura = avatars.find((avatar) => avatar.slotId === 'AURORA')
  const auraSkin = avatars.find((avatar) => avatar.slotId === 'AURA_SKIN')

  return (
    <div className="table-scroll">
      <table className="table table-wrap min-w-[800px] max-sm:min-w-0">
        <thead>
          <tr>
            <th scope="col" className={`${avatarClasses.slotColumn} max-sm:hidden`}>
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
      <td className={`${slot} max-sm:hidden`}>{avatarSlotLabel(avatar.slotName)}</td>
      <td>
        <div className={itemClasses.item}>
          <span className="flex shrink-0 gap-1">
            <ItemIcon itemId={item.itemId} rarity={item.rarity} />
            {cloneId != null && <ItemIcon itemId={cloneId} rarity={null} />}
            {cloneId == null && cloneIconSpace && (
              <span aria-hidden="true" className={itemClasses.iconSpace} />
            )}
          </span>
          <span className="flex min-w-0 items-baseline gap-2 max-md:flex-col max-md:gap-0">
            <span className="shrink-0 whitespace-nowrap max-sm:shrink max-sm:whitespace-normal">
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
        <Emblems emblems={avatar.emblems} />
      </td>
    </tr>
  )
}

type Emblem = Avatar['emblems'][number]

const PLATINUM_SLOT = '플래티넘'

function Emblems({ emblems }: { emblems: readonly Emblem[] }): React.JSX.Element | null {
  const named = emblems.filter((emblem) => emblem.itemName != null)
  if (named.length === 0) {
    return null
  }

  const platinum = named.filter(({ slotColor }) => slotColor === PLATINUM_SLOT)
  const others = named.filter(({ slotColor }) => slotColor !== PLATINUM_SLOT)

  return (
    <span className={avatarClasses.stack}>
      {platinum.map((emblem, index) => (
        <EmblemLine key={emblem.slotNo ?? index} emblem={emblem} />
      ))}
      {others.length > 0 && (
        <span className="max-sm:flex max-sm:flex-col">
          {others.map((emblem, index) => (
            <Fragment key={emblem.slotNo ?? index}>
              {index > 0 && <span className="max-sm:hidden">, </span>}
              <EmblemLine emblem={emblem} />
            </Fragment>
          ))}
        </span>
      )}
    </span>
  )
}

function EmblemLine({ emblem }: { emblem: Emblem }): React.JSX.Element {
  const { itemName, rarity } = toItemView(emblem)

  return <EmblemName name={itemName} rarity={rarity} />
}

function EmblemName({
  name,
  rarity
}: {
  name: string | null
  rarity: ItemRarity | null
}): React.JSX.Element {
  const match = name !== null ? EMBLEM_STAT.exec(name) : null
  const fullName = name ?? MISSING_VALUE
  const shown = match !== null ? match[1] : fullName

  return (
    <b
      title={name ?? undefined}
      className={`font-normal ${rarityTextClasses[rarity ?? 'unknown']}`}
    >
      {shown}
    </b>
  )
}
