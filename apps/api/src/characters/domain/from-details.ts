import { textOrNull } from '@dfragon/lib/utils/shape-check'
import { BufferCharacter, type Character, DealerCharacter } from './character.js'
import { MaleCrusader } from './male-crusader.js'

const awakeningPrefix = '眞'

const bufferJobs = new Set(['크루세이더', '인챈트리스', '패러메딕', '뮤즈'])

const crusader = '크루세이더'
const malePriest = '프리스트(남)'

function baseJobGrowName(jobGrowName: unknown): string | null {
  const name = textOrNull(jobGrowName)
  if (name === null) {
    return null
  }

  if (!name.startsWith(awakeningPrefix)) {
    return name
  }

  return name.slice(awakeningPrefix.length).trim()
}

export function characterFromDetails(
  character: Record<string, unknown>,
  skillStyle: unknown
): Character | null {
  const job = baseJobGrowName(character.jobGrowName)
  if (job === null) {
    return null
  }

  const isMaleCrusader = job === crusader && textOrNull(character.jobName) === malePriest
  if (isMaleCrusader) {
    return new MaleCrusader(skillStyle)
  }

  if (bufferJobs.has(job)) {
    return new BufferCharacter()
  }

  return new DealerCharacter()
}
