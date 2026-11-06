import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const ARTIFACT_DOT_SIZE = 8

export const styles = stylex.create({
  slot: { display: 'inline-flex', alignItems: 'center', gap: space.s8 },
  dot: {
    flexShrink: 0,
    width: ARTIFACT_DOT_SIZE,
    height: ARTIFACT_DOT_SIZE,
    borderRadius: radius.control
  },
  red: { backgroundColor: colors.fgDanger },
  blue: { backgroundColor: colors.scoreDealer },
  green: { backgroundColor: colors.fgSuccess }
})
