import * as stylex from '@stylexjs/stylex'
import { toItemView } from '#core/character/character-item'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { type SlotItemRow, SlotItemTable } from '../equipment/SlotItemTable'
import { styles } from './CreatureTable.style'

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

function creatureRows(creature: Creature): SlotItemRow[] {
  const artifacts = creature.artifact.flatMap((artifact, index) => {
    if (artifact.itemName == null) {
      return []
    }

    const key = artifact.slotColor ?? String(index)

    return [
      {
        key,
        slot: (
          <span {...stylex.props(styles.slot)}>
            <span
              aria-hidden="true"
              {...stylex.props(styles.dot, artifactDotTone(artifact.slotColor))}
            />
            아티팩트
          </span>
        ),
        item: toItemView(artifact)
      }
    ]
  })

  if (creature.itemName == null) {
    return artifacts
  }

  return [{ key: 'creature', slot: '크리쳐', item: toItemView(creature) }, ...artifacts]
}

export function CreatureTable({ creature }: { creature: Creature }): React.JSX.Element {
  return <SlotItemTable itemLabel="크리쳐, 아티팩트" rows={creatureRows(creature)} />
}
