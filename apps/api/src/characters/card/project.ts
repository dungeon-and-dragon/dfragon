import { textOrNull } from '@dfragon/lib/utils/shape-check'
import type { CharacterCard, CharacterRole } from './types.js'

export interface CharacterCardSource {
  character: Record<string, unknown>
}

const awakeningPrefix = '眞'

const bufferJobs = new Set(['인챈트리스', '패러메딕', '뮤즈'])

const crusader = '크루세이더'
const femalePriest = '프리스트(여)'

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

function characterRole(jobName: unknown, jobGrowName: unknown): CharacterRole | null {
  const job = baseJobGrowName(jobGrowName)
  if (job === null) {
    return null
  }

  // Neople은 남녀 프리스트의 전직을 모두 크루세이더로 주고, 남성 크루세이더는 딜러다.
  const isFemaleCrusader = job === crusader && textOrNull(jobName) === femalePriest
  if (isFemaleCrusader || bufferJobs.has(job)) {
    return 'buffer'
  }

  return 'dealer'
}

export function projectCharacterCard(details: CharacterCardSource): CharacterCard {
  const role = characterRole(details.character.jobName, details.character.jobGrowName)

  return { role, stats: null, score: null, serverRank: null, set: null, oath: null, investment: [] }
}
