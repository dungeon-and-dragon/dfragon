import { colors, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  progress: { display: 'inline-flex', alignItems: 'center', gap: space.s8 },
  track: {
    flexShrink: 0,
    width: 88,
    height: 6,
    borderRadius: 1,
    backgroundColor: colors.bgControl,
    overflow: 'hidden'
  },
  wideTrack: { width: 320, height: 8 },
  fill: { display: 'block', height: '100%', backgroundColor: colors.fgMuted },
  fillWidth: (percent: number) => ({ width: `${percent}%` }),
  count: { fontWeight: 500, fontVariantNumeric: 'tabular-nums' }
})
