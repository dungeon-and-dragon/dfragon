import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const ARTIFACT_DOT_SIZE = 8

export const styles = stylex.create({
  creature: { fontSize: 14, lineHeight: '20px', fontWeight: 600 },
  artifacts: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 13,
    lineHeight: '18px'
  },
  artifact: { display: 'flex', alignItems: 'center', gap: space.s8 },
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
