import * as stylex from '@stylexjs/stylex'
import { CreatureArtifacts } from './avatar/CreatureArtifacts'
import { AvatarTable } from './avatar/AvatarTable'
import { styles } from './avatar/detail-tab.style'
import type { CharacterTabProps } from './character-tab-props'

export function AvatarCreatureTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { avatar, creature } = detail

  return (
    <div {...stylex.props(styles.tab)}>
      {avatar.length > 0 && (
        <section aria-label="아바타" {...stylex.props(styles.section)}>
          <h2 {...stylex.props(styles.heading)}>아바타</h2>
          <AvatarTable avatars={avatar} />
        </section>
      )}
      {creature != null && (
        <section aria-label="크리쳐" {...stylex.props(styles.section)}>
          <h2 {...stylex.props(styles.heading)}>크리쳐</h2>
          <CreatureArtifacts creature={creature} />
        </section>
      )}
    </div>
  )
}
