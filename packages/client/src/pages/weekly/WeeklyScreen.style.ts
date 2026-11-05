import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const ADVENTURE_INPUT_WIDTH = 200
const CLEAR_COLUMN_WIDTH = 96
const CLEAR_MARK_SIZE = 16

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  form: { display: 'flex', alignItems: 'center', gap: space.s8 },
  adventureInput: { width: ADVENTURE_INPUT_WIDTH },
  state: {
    margin: 0,
    paddingBlock: space.s16,
    paddingInline: space.s16,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgMuted
  },
  error: { color: colors.fgDanger },
  clearColumn: { width: CLEAR_COLUMN_WIDTH },
  clearName: { wordBreak: 'keep-all', overflowWrap: 'anywhere' },
  check: {
    display: 'inline-block',
    width: CLEAR_MARK_SIZE,
    height: CLEAR_MARK_SIZE,
    verticalAlign: 'middle',
    color: colors.fgSuccess
  },
  blank: {
    display: 'inline-block',
    width: CLEAR_MARK_SIZE,
    height: CLEAR_MARK_SIZE,
    boxSizing: 'border-box',
    verticalAlign: 'middle',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderInput,
    borderRadius: radius.control
  }
})
