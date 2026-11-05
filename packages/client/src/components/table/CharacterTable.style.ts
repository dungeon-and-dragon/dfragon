import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const ROW_HEIGHT = 64
const RANK_COLUMN_WIDTH = 64
const FAME_COLUMN_WIDTH = 120
const AFFILIATION_COLUMN_WIDTH = 160
const ACTION_COLUMN_WIDTH = 56

export const styles = stylex.create({
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' },
  rankColumn: { width: RANK_COLUMN_WIDTH },
  fameColumn: { width: FAME_COLUMN_WIDTH },
  affiliationColumn: { width: AFFILIATION_COLUMN_WIDTH },
  actionColumn: { width: ACTION_COLUMN_WIDTH },
  headCell: {
    height: 32,
    paddingInline: space.s12,
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 500,
    textAlign: 'left',
    color: colors.fgSubtle
  },
  cell: {
    height: ROW_HEIGHT,
    boxSizing: 'border-box',
    paddingInline: space.s12,
    fontSize: 13,
    lineHeight: '18px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
  fame: { fontWeight: 600, color: colors.gameFame, fontVariantNumeric: 'tabular-nums' },
  affiliation: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.fgAdventure
  },
  link: {
    color: 'inherit',
    textDecoration: { default: 'none', ':hover': 'underline' }
  },
  missing: { color: colors.fgDisabled },
  bone: {
    display: 'block',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  boneSize: (width: number, height: number) => ({ width, height }),
  boneCharacter: { display: 'flex', alignItems: 'center', gap: space.s12 },
  boneLines: { display: 'flex', flexDirection: 'column', gap: 6 }
})
