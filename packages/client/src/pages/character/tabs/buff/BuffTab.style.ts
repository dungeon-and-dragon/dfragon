import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const EQUIPMENT_COLUMN_WIDTH = 320

export const styles = stylex.create({
  skill: { display: 'flex', flexDirection: 'column', gap: space.s8 },
  skillTitle: { display: 'flex', alignItems: 'baseline', gap: space.s8 },
  skillName: { margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 700 },
  skillLevel: { fontSize: 13, color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums' },
  optionLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 13,
    lineHeight: '20px',
    color: colors.fgMuted
  },
  columns: { display: 'flex', alignItems: 'flex-start', gap: space.s24 },
  equipment: { flexShrink: 0, width: EQUIPMENT_COLUMN_WIDTH },
  side: { display: 'flex', flexDirection: 'column', gap: space.s24, flexGrow: 1, minWidth: 0 },
  creatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 13,
    lineHeight: '18px'
  }
})
