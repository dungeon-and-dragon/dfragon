import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const STATUS_COLUMNS = 4
const ELEMENT_ICON_SIZE = 16

export const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${STATUS_COLUMNS}, minmax(0, 1fr))`,
    columnGap: space.s24,
    margin: 0,
    fontSize: 13,
    lineHeight: '18px'
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s8,
    minWidth: 0,
    paddingBlock: 6,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s4,
    minWidth: 0,
    margin: 0,
    color: colors.fgMuted
  },
  elementIcon: { flexShrink: 0, width: ELEMENT_ICON_SIZE, height: ELEMENT_ICON_SIZE },
  value: {
    margin: 0,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
    color: colors.fgDefault
  },
  buffs: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 13,
    lineHeight: '18px'
  },
  buff: { display: 'flex', alignItems: 'baseline', gap: space.s8 },
  buffName: { fontWeight: 600 },
  buffLevel: { color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums' },
  buffStatus: { color: colors.fgMuted, fontVariantNumeric: 'tabular-nums' }
})
