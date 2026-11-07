import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from '@dfragon/ui/tokens.stylex'
import { breakpoints } from '../../styles/breakpoints.stylex'

const TAB_COLUMN_WIDTH = 120
const TAB_OUTSIDE_GAP = 16
const LABEL_COLUMN_WIDTH = 24
const CELL_MIN_SIZE = 8
const CELL_MAX_SIZE = 26
const CELL_GAP = 4
const LABEL_HEIGHT = 14
const LEGEND_SWATCH_SIZE = 12
const SKELETON_HEIGHT = 280
const TAG_HEIGHT = 18
// gsap이 heatmap 격자에 이 이름의 CSS 변수를 돌리고, 테두리가 상속받아 각도로 쓴다.
const RING_ANGLE = 'calc(var(--heatmap-ring-angle, 0) * 1deg)'

export const styles = stylex.create({
  box: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: {
      default: `minmax(0, 1fr) ${TAB_COLUMN_WIDTH}px`,
      [breakpoints.screenSideRoom]: 'minmax(0, 1fr)'
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas
  },
  skeleton: { minHeight: SKELETON_HEIGHT },
  panel: { minWidth: 0, outline: 'none' },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: TAG_HEIGHT,
    paddingTop: space.s12,
    paddingInline: space.s16
  },
  tags: { display: 'flex', gap: space.s8 },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    height: TAG_HEIGHT,
    paddingInline: 5,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums'
  },
  legendary: { color: colors.rarityLegendary },
  epic: { color: colors.rarityEpic },
  primordialTag: { color: colors.rarityPrimordial },
  mythicTag: { color: colors.rarityMythic },
  primordialText: {
    color: 'transparent',
    backgroundImage: colors.rarityPrimordialGradient,
    backgroundClip: 'text'
  },
  mythicText: {
    color: 'transparent',
    backgroundImage: colors.rarityMythicGradient,
    backgroundClip: 'text'
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s4,
    marginInlineStart: 'auto',
    fontSize: 11,
    lineHeight: '14px',
    color: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums'
  },
  swatch: {
    width: LEGEND_SWATCH_SIZE,
    height: LEGEND_SWATCH_SIZE,
    borderRadius: radius.control
  },
  gridArea: { overflowX: 'auto', padding: space.s16, paddingTop: space.s12 },
  grid: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridTemplateRows: `${LABEL_HEIGHT}px repeat(7, auto)`,
    gap: CELL_GAP,
    alignItems: 'center'
  },
  columns: (weeks: number) => ({
    gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px repeat(${weeks}, minmax(${CELL_MIN_SIZE}px, ${CELL_MAX_SIZE}px))`
  }),
  label: {
    fontSize: 11,
    lineHeight: `${LABEL_HEIGHT}px`,
    color: colors.fgSubtle,
    whiteSpace: 'nowrap'
  },
  cell: {
    position: 'relative',
    display: 'block',
    aspectRatio: '1',
    boxSizing: 'border-box',
    borderRadius: radius.control
  },
  future: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderDefault
  },
  empty: { backgroundColor: colors.bgInset },
  all: { color: colors.fgDefault },
  raid: { color: colors.fgSuccess },
  legion: { color: colors.fgSuccess },
  item: { color: colors.rarityEpic },
  enhance: { color: colors.gameEnhance },
  level1: { backgroundColor: `color-mix(in srgb, currentColor 22%, ${colors.bgInset})` },
  level2: { backgroundColor: `color-mix(in srgb, currentColor 46%, ${colors.bgInset})` },
  level3: { backgroundColor: `color-mix(in srgb, currentColor 73%, ${colors.bgInset})` },
  level4: { backgroundColor: 'currentColor' },
  today: { outline: `1px solid ${colors.fgDefault}`, outlineOffset: 1 },
  active: {
    boxShadow: { default: null, ':hover': `0 0 0 2px ${colors.fgDefault}` },
    cursor: 'default'
  },
  ring: {
    position: 'absolute',
    inset: -3,
    padding: 2,
    borderRadius: 3,
    maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
    maskClip: 'content-box, border-box',
    maskComposite: 'exclude',
    pointerEvents: 'none'
  },
  glow: { inset: -4, padding: 3, filter: 'blur(3px)', opacity: 0.35 },
  primeval: {
    backgroundImage: `conic-gradient(from ${RING_ANGLE}, color-mix(in srgb, ${colors.rarityPrimordialStart} 45%, transparent) 0deg, color-mix(in srgb, ${colors.rarityPrimordialEnd} 45%, transparent) 220deg, ${colors.rarityPrimordialStart} 290deg, ${colors.rarityPrimordialEnd} 345deg, color-mix(in srgb, ${colors.rarityPrimordialStart} 45%, transparent) 360deg)`
  },
  mythic: {
    backgroundImage: `conic-gradient(from ${RING_ANGLE}, color-mix(in srgb, ${colors.rarityMythicStart} 45%, transparent) 0deg, color-mix(in srgb, ${colors.rarityMythicEnd} 45%, transparent) 220deg, ${colors.rarityMythicStart} 290deg, ${colors.rarityMythicEnd} 345deg, color-mix(in srgb, ${colors.rarityMythicStart} 45%, transparent) 360deg)`
  },
  tabs: {
    position: { default: 'relative', [breakpoints.screenSideRoom]: 'absolute' },
    top: { default: null, [breakpoints.screenSideRoom]: 0 },
    left: { default: null, [breakpoints.screenSideRoom]: '100%' },
    display: 'flex',
    flexDirection: 'column',
    width: { default: null, [breakpoints.screenSideRoom]: TAB_COLUMN_WIDTH },
    marginLeft: { default: null, [breakpoints.screenSideRoom]: TAB_OUTSIDE_GAP },
    paddingBlock: { default: space.s12, [breakpoints.screenSideRoom]: 0 },
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: colors.borderDefault
  },
  tab: {
    display: 'block',
    width: '100%',
    margin: 0,
    paddingBlock: 6,
    paddingInlineStart: space.s12,
    paddingInlineEnd: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: '18px',
    fontWeight: { default: 500, ':is([data-active])': 700 },
    textAlign: 'left',
    cursor: 'pointer',
    color: {
      default: colors.fgSubtle,
      ':hover': colors.fgDefault,
      ':is([data-active])': colors.fgDefault
    },
    outline: { default: 'none', ':focus-visible': `2px solid ${colors.fgDefault}` },
    outlineOffset: -2
  },
  indicator: {
    position: 'absolute',
    left: -1,
    top: 'calc(var(--active-tab-top) + 4px)',
    width: 2,
    height: 'calc(var(--active-tab-height) - 8px)',
    backgroundColor: colors.fgDefault,
    transitionProperty: 'top, height',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
