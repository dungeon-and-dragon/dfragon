import type { StoredCharacter } from '@dfragon/database'

export function averageFame(members: readonly StoredCharacter[]): number | null {
  const fames = members.map(({ fame }) => fame).filter((fame) => fame !== null)
  if (fames.length === 0) {
    return null
  }

  return Math.round(fames.reduce((sum, fame) => sum + fame, 0) / fames.length)
}
