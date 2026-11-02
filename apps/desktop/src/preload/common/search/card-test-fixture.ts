import type { CharacterCard } from '../types/character'

export const dealerCard: CharacterCard = { role: 'dealer', score: null }

export const bufferCard: CharacterCard = { role: 'buffer', score: null }

export function scoredDealerCard(value: number): CharacterCard {
  return {
    role: 'dealer',
    score: {
      calculator: 'equipment',
      value,
      skipped: null,
      approximate: null,
      versions: { package: 'synthetic-engine 0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    }
  }
}
