import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const toneStyles = stylex.create({
  default: {},
  increase: { color: colors.gameIncrease },
  decrease: { color: colors.gameDecrease },
  amplify: { color: colors.gameAmplify },
  enhance: { color: colors.gameEnhance },
  refine: { color: colors.gameRefine },
  set: { color: colors.gameSet },
  disabled: { color: colors.fgSubtle },
  'rarity-rare': { color: colors.rarityRare },
  'rarity-unique': { color: colors.rarityUnique },
  'rarity-epic': { color: colors.rarityEpic },
  'rarity-legendary': { color: colors.rarityLegendary },
  'rarity-chronicle': { color: colors.rarityChronicle },
  'rarity-primordial': {
    color: 'transparent',
    backgroundImage: colors.rarityPrimordialGradient,
    backgroundClip: 'text'
  }
})

export const styles = stylex.create({
  text: { margin: 0 },
  line: { display: 'block', minHeight: '1lh', whiteSpace: 'pre-wrap' }
})
