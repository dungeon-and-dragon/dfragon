import type { TimelineClearCount } from '#domain/character-timeline/index.js'
import { CLEAR_CONTENTS, type ClearContent } from './contents.js'
import { CLEAR_LEGIONS } from './legions.js'

type ClearName = Pick<TimelineClearCount, 'kind' | 'name'>

// 레이드는 일반과 하드 가운데 먼저 나온 날을 그 레이드의 출시일로 본다.
function releasedAtOf(
  { kind, name }: ClearName,
  contents: readonly ClearContent[],
  legions: readonly ClearContent[]
): number | undefined {
  if (kind === 'legion') {
    return legions.find((legion) => legion.name === name)?.releasedAt.getTime()
  }

  const releases = contents.flatMap(({ rule, releasedAt }) =>
    rule.type === 'clear' && rule.name === name ? [releasedAt.getTime()] : []
  )

  if (releases.length === 0) {
    return undefined
  }

  return Math.min(...releases)
}

export function sortClearCountsByRelease(
  counts: readonly TimelineClearCount[],
  contents: readonly ClearContent[] = CLEAR_CONTENTS,
  legions: readonly ClearContent[] = CLEAR_LEGIONS
): TimelineClearCount[] {
  const known = counts.flatMap((count) => {
    const releasedAt = releasedAtOf(count, contents, legions)

    if (releasedAt === undefined) {
      return []
    }

    return [{ count, releasedAt }]
  })
  const unknown = counts.filter((count) => releasedAtOf(count, contents, legions) === undefined)
  const recentFirst = known
    .toSorted((a, b) => b.releasedAt - a.releasedAt)
    .map(({ count }) => count)

  return [...recentFirst, ...unknown]
}
