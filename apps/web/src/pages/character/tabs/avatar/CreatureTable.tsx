import { toItemView } from '#core/character/character-item'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { type SlotItemRow, SlotItemTable } from '../equipment/SlotItemTable'
import { artifactDotClasses } from './avatar-classes'

type Creature = NonNullable<CharacterDetailView['creature']>

const ARTIFACT_DOT_TONES: Readonly<Record<string, string>> = {
  RED: artifactDotClasses.red,
  BLUE: artifactDotClasses.blue,
  GREEN: artifactDotClasses.green
}

function artifactDotTone(slotColor: string | null): string {
  const tone = slotColor != null ? ARTIFACT_DOT_TONES[slotColor] : undefined
  if (tone == null) {
    return ''
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
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-badge ${artifactDotTone(artifact.slotColor)}`}
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
