import * as stylex from '@stylexjs/stylex'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { ItemName } from './ItemName'
import { styles as layout } from './detail-tab.style'
import { styles } from './CreatureArtifacts.style'

type Creature = NonNullable<CharacterDetailView['creature']>

const ARTIFACT_DOT_TONES: Readonly<Record<string, typeof styles.red>> = {
  RED: styles.red,
  BLUE: styles.blue,
  GREEN: styles.green
}

function artifactDotTone(slotColor: string | null) {
  const tone = slotColor != null ? ARTIFACT_DOT_TONES[slotColor] : undefined
  if (tone == null) {
    return null
  }

  return tone
}

export function CreatureArtifacts({ creature }: { creature: Creature }): React.JSX.Element {
  return (
    <div {...stylex.props(layout.stack)}>
      {creature.itemName != null && (
        <span {...stylex.props(styles.creature)}>
          <ItemName name={creature.itemName} rarity={creature.itemRarity} />
        </span>
      )}
      {creature.artifact.length > 0 && (
        <ul aria-label="아티팩트" {...stylex.props(styles.artifacts)}>
          {creature.artifact.map(
            (artifact, index) =>
              artifact.itemName != null && (
                <li key={artifact.slotColor ?? index} {...stylex.props(styles.artifact)}>
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.dot, artifactDotTone(artifact.slotColor))}
                  />
                  <ItemName name={artifact.itemName} rarity={artifact.itemRarity} />
                </li>
              )
          )}
        </ul>
      )}
    </div>
  )
}
