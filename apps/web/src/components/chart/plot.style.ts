import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const AXIS_FONT_SIZE = 11
const LEGEND_MARK_SIZE = 8
const LEGEND_LINE_WIDTH = 14
const LEGEND_LINE_HEIGHT = 2
const SWATCH_SIZE = 8

export const plotStyles = stylex.create({
  plot: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: space.s16
  },
  area: { position: 'relative', flexGrow: 1 },
  areaHeight: (height: number) => ({ minHeight: height }),
  svg: { position: 'absolute', inset: 0, display: 'block', overflow: 'visible' },
  axisText: {
    fontSize: AXIS_FONT_SIZE,
    fill: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums'
  },
  axisTextStrong: { fill: colors.fgDefault },
  grid: { stroke: colors.bgInset, strokeWidth: 1 },
  base: { stroke: colors.borderStrong, strokeWidth: 1 },
  selected: { fill: colors.bgInset },
  line: {
    fill: 'none',
    strokeWidth: 2,
    strokeLinejoin: 'round',
    strokeLinecap: 'round'
  },
  stroke: (color: string) => ({ stroke: color }),
  fill: (color: string) => ({ fill: color }),
  endDot: { stroke: colors.bgCanvas, strokeWidth: 2 },
  openDot: { fill: colors.bgCanvas, strokeWidth: 2 },
  crosshair: { stroke: colors.borderStrong, strokeWidth: 1 },
  bar: {
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  barDimmed: { opacity: 0.3 },
  hits: { position: 'absolute', inset: 0, margin: 0, padding: 0, listStyle: 'none' },
  hit: { position: 'absolute', top: 0, bottom: 0 },
  hitPlace: (left: number, width: number) => ({ left, width }),
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 16px',
    margin: 0,
    marginBottom: 10,
    padding: 0,
    listStyle: 'none',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  legendBelow: { marginBottom: 0, marginTop: space.s12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendMark: {
    flexShrink: 0,
    width: LEGEND_MARK_SIZE,
    height: LEGEND_MARK_SIZE,
    borderRadius: 2
  },
  legendLine: { width: LEGEND_LINE_WIDTH, height: LEGEND_LINE_HEIGHT, borderRadius: 0 },
  legendWide: { width: LEGEND_LINE_WIDTH },
  legendDot: { borderRadius: '50%' },
  background: (color: string) => ({ backgroundColor: color }),
  backgroundImage: (image: string) => ({ backgroundImage: image }),
  tooltipRows: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 },
  tooltipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    lineHeight: '16px',
    fontVariantNumeric: 'tabular-nums'
  },
  tooltipName: { color: colors.fgMuted },
  tooltipValue: { marginLeft: 'auto', paddingLeft: space.s12, fontWeight: 600 },
  swatch: { flexShrink: 0, width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: 2 }
})
