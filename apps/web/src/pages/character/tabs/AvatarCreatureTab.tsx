import * as stylex from '@stylexjs/stylex'
import { AvatarTable } from './avatar/AvatarTable'
import { CreatureTable } from './avatar/CreatureTable'
import type { CharacterTabProps } from './character-tab-props'
import { styles as tableStyles } from './equipment/item-table.style'

export function AvatarCreatureTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { avatar, creature } = detail

  return (
    <div {...stylex.props(tableStyles.root)}>
      {avatar.length > 0 && (
        <section aria-label="아바타">
          <h2 {...stylex.props(tableStyles.heading)}>아바타</h2>
          <AvatarTable avatars={avatar} />
        </section>
      )}
      {creature != null && (
        <section aria-label="크리쳐">
          <h2 {...stylex.props(tableStyles.heading)}>크리쳐</h2>
          <CreatureTable creature={creature} />
        </section>
      )}
    </div>
  )
}
