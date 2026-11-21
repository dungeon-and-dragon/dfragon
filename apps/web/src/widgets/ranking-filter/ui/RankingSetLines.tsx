import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { OathCatalog } from '#entities/catalog'
import type { RankedCharacter } from '#entities/ranking'
import { rankingSetLines } from '#widgets/ranking-filter/lib/ranking-sets'

export function RankingSetLines({
  character,
  catalog
}: {
  character: Pick<RankedCharacter, 'equipmentSet' | 'oathSet'>
  catalog: OathCatalog | null
}): React.JSX.Element {
  const { equipment, oath } = rankingSetLines(character, catalog)

  if (equipment === null && oath === null) {
    return <span className="text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate leading-4">{equipment ?? MISSING_VALUE}</span>
      <span className="truncate text-xs leading-4 text-fg-muted">{oath ?? MISSING_VALUE}</span>
    </span>
  )
}
