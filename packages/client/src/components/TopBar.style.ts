import * as stylex from '@stylexjs/stylex'
import { colors, font, size, space } from '@dfragon/ui/tokens.stylex'

const bar = {
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  paddingInline: space.s16,
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: colors.borderDefault
} as const

export const styles = stylex.create({
  header: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    width: '100%',
    color: colors.fgDefault,
    position: 'relative'
  },
  globalBar: { ...bar, gap: space.s16, height: size.topbar, backgroundColor: colors.bgBar },
  gameBar: { ...bar, gap: space.s12, height: 40, backgroundColor: colors.bgSurface },
  brand: { display: 'flex', alignItems: 'center', gap: space.s8, flexShrink: 0 },
  brandIcon: { display: 'block', imageRendering: 'pixelated' },
  name: {
    whiteSpace: 'nowrap',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: '24px',
    color: colors.fgDefault
  },
  divider: { flexShrink: 0, width: 1, height: 20, backgroundColor: colors.borderDefault },
  grade: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  percent: {
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
  unknown: { color: colors.fgMuted },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexShrink: 0,
    marginInlineStart: 'auto'
  }
})
