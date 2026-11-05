import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  common: { color: colors.rarityCommon },
  uncommon: { color: colors.rarityUncommon },
  rare: { color: colors.rarityRare },
  unique: { color: colors.rarityUnique },
  legendary: { color: colors.rarityLegendary },
  epic: { color: colors.rarityEpic },
  chronicle: { color: colors.rarityChronicle },
  primordial: {
    color: 'transparent',
    backgroundImage: colors.rarityPrimordialGradient,
    backgroundClip: 'text'
  },
  mythic: {
    color: 'transparent',
    backgroundImage: colors.rarityMythicGradient,
    backgroundClip: 'text'
  },
  unknown: { color: colors.fgDefault }
})
