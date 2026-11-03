import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, size, space } from './tokens.stylex'

const onCard = ':is([data-surface="card"])'

export const styles = stylex.create({
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s4,
    minWidth: 0,
    margin: 0,
    paddingInlineStart: space.s8,
    paddingInlineEnd: 6,
    borderWidth: 0,
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    color: {
      default: colors.fgDefault,
      ':is([data-popup-open])': colors.onSignal,
      ':disabled': colors.fgDisabled
    },
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled, [data-popup-open])': colors.bgControlHover,
      ':is([data-popup-open])': colors.signal
    }
  },
  '2xs': {
    height: 20,
    gap: 2,
    fontSize: 11,
    fontWeight: 500,
    paddingInlineStart: 6,
    paddingInlineEnd: space.s4
  },
  xs: { height: 24, fontSize: 12 },
  sm: { height: size.controlSm, fontSize: 13 },
  md: { height: size.controlMd, fontSize: 14 },
  value: { overflow: 'hidden', textOverflow: 'ellipsis' },
  placeholder: { color: colors.fgPlaceholder },
  icon: {
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: 14,
    transform: { default: 'none', ':is([data-popup-open])': 'scaleY(-1)' },
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  item: {
    height: { default: 28, [stylex.when.ancestor(onCard)]: 32 },
    fontSize: 13
  },
  grid: (columns: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, auto)`
  }),
  cardGrid: (columns: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 84px)`,
    gap: 2
  }),
  // 표 행의 작은 칩은 행 글자보다 한 단계 흐린 글자로 두고, 올리거나 열면 surface의 글자색으로 돌아간다.
  mutedText: {
    color: {
      default: colors.fgMuted,
      ':hover:not(:disabled)': colors.fgDefault,
      ':is([data-popup-open])': colors.fgDefault,
      ':disabled': colors.fgDisabled
    }
  },
  // 표 행의 칩은 열어도 신호색으로 채우지 않고 올린 면 그대로 둔다. 신호색은 목록의 지금 항목이 쓴다.
  cardTrigger: {
    color: {
      default: colors.cardFg,
      ':disabled': colors.cardFgSubtle
    },
    backgroundColor: {
      default: colors.cardControl,
      ':hover:not(:disabled)': colors.cardControlHover,
      ':is([data-popup-open])': colors.cardControlHover
    },
    outlineColor: colors.cardSignal
  }
})
