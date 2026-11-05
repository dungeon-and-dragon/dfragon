import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  percent: {
    flexShrink: 0,
    fontFamily: font.num,
    fontSize: 16,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    lineHeight: '20px',
    whiteSpace: 'nowrap'
  },
  common: { color: colors.rarityCommon },
  uncommon: { color: colors.rarityUncommon },
  epic: { color: colors.rarityEpic },
  primordial: { color: colors.rarityPrimordial },
  unknown: { color: colors.fgMuted }
})
