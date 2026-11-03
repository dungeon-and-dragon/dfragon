import * as stylex from '@stylexjs/stylex'
import { colors, size, space } from '@dfragon/ui/tokens.stylex'

const HIDE_NAME = '@container (max-width: 900px)'

const bar = {
  display: 'flex',
  alignItems: 'center',
  gap: space.s16,
  boxSizing: 'border-box',
  paddingInline: space.s24,
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
    containerType: 'inline-size',
    color: colors.fgDefault,
    position: 'relative'
  },
  globalBar: { ...bar, height: size.topbar, backgroundColor: colors.bgBar },
  gameBar: { ...bar, height: 40, backgroundColor: colors.bgSurface },
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
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexShrink: 0,
    marginInlineStart: 'auto'
  }
})
