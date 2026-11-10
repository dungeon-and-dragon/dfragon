import { colors, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  figures: {
    display: 'flex',
    gap: 40,
    margin: 0,
    padding: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  figure: { display: 'flex', flexDirection: 'column', gap: 2 },
  figureLabel: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgSubtle },
  figureValue: {
    margin: 0,
    fontSize: 24,
    lineHeight: '30px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums'
  },
  figureTime: { fontSize: 16, fontWeight: 600 }
})
