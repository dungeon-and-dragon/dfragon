import * as stylex from '@stylexjs/stylex'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

const blink = stylex.keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.35 }
})

export const styles = stylex.create({
  progress: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: colors.fgMuted
  },
  dots: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  dot: {
    flexShrink: 0,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.borderStrong
  },
  done: { backgroundColor: colors.signal },
  active: {
    backgroundColor: colors.signal,
    animationName: { default: blink, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  }
})
