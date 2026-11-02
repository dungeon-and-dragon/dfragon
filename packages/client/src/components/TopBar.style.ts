import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const HIDE_NAME = '@container (max-width: 900px)'

export const styles = stylex.create({
  header: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: space.s16,
    width: '100%',
    height: 44,
    boxSizing: 'border-box',
    paddingInline: 24,
    containerType: 'inline-size',
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    color: colors.fgDefault,
    position: 'relative'
  },
  brand: { display: 'flex', alignItems: 'center', gap: space.s8, flexShrink: 0 },
  percent: { whiteSpace: 'nowrap' },
  common: { color: colors.rarityCommon },
  uncommon: { color: colors.rarityUncommon },
  epic: { color: colors.rarityEpic },
  primordial: { color: colors.rarityPrimordial },
  unknown: { color: colors.fgMuted },
  name: {
    display: { default: 'inline', [HIDE_NAME]: 'none' },
    whiteSpace: 'nowrap',
    color: colors.fgDefault
  },
  divider: { width: 1, height: 24, flexShrink: 0, backgroundColor: colors.borderDefault },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexShrink: 0
  }
})
