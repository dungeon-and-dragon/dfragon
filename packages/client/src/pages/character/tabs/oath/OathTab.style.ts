import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const SIDE_WIDTH = 480
const SET_ICON_WELL_SIZE = 56
const SET_ICON_SIZE = 40
const OPTION_ICON_SIZE = 46

export const styles = stylex.create({
  body: { display: 'flex', alignItems: 'flex-start' },
  main: {
    flexGrow: 1,
    minWidth: 0,
    borderInlineEndWidth: 1,
    borderInlineEndStyle: 'solid',
    borderInlineEndColor: colors.borderDefault
  },
  side: { flexShrink: 0, width: SIDE_WIDTH },
  slotColumn: { width: 56 },
  setCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  setIconWell: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    width: SET_ICON_WELL_SIZE,
    height: SET_ICON_WELL_SIZE,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  setIcon: { width: SET_ICON_SIZE, height: SET_ICON_SIZE, imageRendering: 'pixelated' },
  setTitle: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.s8,
    fontSize: 18,
    lineHeight: '24px'
  },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: space.s12,
    padding: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  option: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    margin: 0,
    paddingBlock: 14,
    paddingInline: space.s16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    backgroundColor: colors.bgBar
  },
  optionPicked: {
    borderStyle: 'solid',
    borderColor: colors.signal,
    boxShadow: `0 0 0 1px ${colors.signal}`,
    backgroundColor: colors.bgSurface
  },
  optionIcon: {
    flexShrink: 0,
    width: OPTION_ICON_SIZE,
    height: OPTION_ICON_SIZE,
    borderRadius: OPTION_ICON_SIZE / 2
  },
  optionIconDim: { opacity: 0.4, filter: 'grayscale(0.8)' },
  optionEffect: { flexGrow: 1, minWidth: 0, fontSize: 12, lineHeight: '18px' },
  bodyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  pointColumn: { width: 110 },
  list: { margin: 0, padding: 0 },
  line: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s12,
    height: 32,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  term: { color: colors.fgMuted },
  value: { margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }
})
