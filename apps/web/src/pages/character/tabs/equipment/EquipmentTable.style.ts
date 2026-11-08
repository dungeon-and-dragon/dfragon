import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  slotColumn: { width: 76 },
  reinforceColumn: { width: 112 },
  enchantColumn: { width: 330 },
  pointColumn: { width: 88 },
  potencyColumn: { width: 76 },
  amplify: { color: colors.gameAmplify, fontWeight: 600 },
  enhance: { color: colors.gameEnhance, fontWeight: 600 },
  refine: { marginInlineStart: 6, color: colors.gameRefine, fontSize: 12 },
  enchant: { color: colors.gameEnchant, fontSize: 12, lineHeight: '16px' },
  minorEnchant: { opacity: 0.5 },
  potency: { color: colors.gamePrecision }
})
