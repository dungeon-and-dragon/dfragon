import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from '@dfragon/ui/tokens.stylex'

const WIDTH = 184
const ROW_HEIGHT = 28
const SELECTED_HEIGHT = 34

export const styles = stylex.create({
  wheel: { flexShrink: 0, display: 'flex', flexDirection: 'column', width: WIDTH },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ROW_HEIGHT,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 13,
    lineHeight: '18px',
    fontVariantNumeric: 'tabular-nums',
    color: { default: colors.fgSubtle, ':hover': colors.fgDefault },
    cursor: 'pointer',
    transitionProperty: 'color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  selected: {
    height: SELECTED_HEIGHT,
    borderBlockWidth: 1,
    borderBlockStyle: 'solid',
    borderBlockColor: colors.borderInput,
    fontSize: 16,
    lineHeight: '22px',
    fontWeight: 700,
    color: { default: colors.fgDefault, ':hover': colors.fgDefault },
    cursor: 'default'
  },
  empty: { height: ROW_HEIGHT },
  open: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 16,
    paddingInline: 5,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 500
  }
})
