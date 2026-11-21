import { AvatarTable } from './avatar/AvatarTable'
import { CreatureTable } from './avatar/CreatureTable'
import type { CharacterTabProps } from './character-tab-props'
import { itemTableClasses } from './equipment/item-classes'

export function AvatarCreatureTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { avatar, creature } = detail

  return (
    <div className={`${itemTableClasses.root} divide-y divide-line`}>
      {avatar.length > 0 && (
        <section aria-label="아바타">
          <AvatarTable avatars={avatar} />
        </section>
      )}
      {creature != null && (
        <section aria-label="크리쳐">
          <CreatureTable creature={creature} />
        </section>
      )}
    </div>
  )
}
