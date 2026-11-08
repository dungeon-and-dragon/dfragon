import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const BODY_MIN_HEIGHT = 480

export const styles = stylex.create({
  screen: { padding: space.s16 },
  box: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  header: {
    padding: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  },
  title: { margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 700 },
  body: { minHeight: BODY_MIN_HEIGHT }
})
