import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from './tokens.stylex'

const openShape = 'inset(0)'
const foldedShape = 'inset(0 0 100% 0)'
const onCard = ':is([data-surface="card"])'

export const listboxStyles = stylex.create({
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    minWidth: 'max(112px, var(--anchor-width))',
    maxHeight: 'var(--available-height)',
    paddingBlock: space.s4,
    overflowY: 'auto',
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.signal,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.borderStrong}`,
    color: colors.fgMuted,
    outlineStyle: 'none',
    clipPath: {
      default: openShape,
      ':is([data-starting-style], [data-ending-style])': foldedShape
    },
    transitionProperty: 'clip-path',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  item: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    paddingInline: { default: space.s12, [stylex.when.ancestor(onCard)]: 10 },
    outlineStyle: 'none',
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    userSelect: 'none',
    color: {
      default: 'inherit',
      ':is([data-highlighted])': {
        default: colors.fgDefault,
        [stylex.when.ancestor(onCard)]: colors.cardFg
      },
      ':is([data-selected], [data-checked])': {
        default: colors.signal,
        [stylex.when.ancestor(onCard)]: colors.cardSignal
      },
      ':is([data-disabled])': {
        default: colors.fgDisabled,
        [stylex.when.ancestor(onCard)]: colors.cardBorderStrong
      }
    },
    fontWeight: {
      default: 'inherit',
      ':is([data-selected], [data-checked])': {
        default: 700,
        [stylex.when.ancestor(onCard)]: 600
      }
    },
    borderRadius: { default: null, [stylex.when.ancestor(onCard)]: radius.control },
    backgroundColor: {
      default: 'transparent',
      ':is([data-highlighted])': {
        default: colors.bgControlHover,
        [stylex.when.ancestor(onCard)]: colors.cardControl
      }
    },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  marker: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    width: 2,
    backgroundColor: { default: colors.signal, [stylex.when.ancestor(onCard)]: colors.cardSignal }
  },
  groupLabel: {
    paddingInline: space.s12,
    paddingBlock: space.s4,
    fontSize: 12,
    lineHeight: '18px',
    fontWeight: 600,
    color: { default: colors.fgSubtle, [stylex.when.ancestor(onCard)]: colors.cardFgSubtle }
  },
  separator: {
    height: 1,
    marginBlock: space.s4,
    backgroundColor: {
      default: colors.borderDefault,
      [stylex.when.ancestor(onCard)]: colors.cardBorder
    }
  },
  // 표 행 위에 뜨는 팝오버는 면과 1px 테두리에 그림자를 두며, 그림자를 자르지 않게 펼침 clip-path를 쓰지 않는다.
  cardPopup: {
    paddingInline: space.s4,
    borderTopWidth: 0,
    backgroundColor: colors.bgSurface,
    boxShadow: `inset 0 0 0 1px ${colors.cardBorderStrong}, 0 8px 24px rgb(0 0 0 / 45%)`,
    color: colors.cardFgMuted,
    clipPath: 'none',
    transitionProperty: 'none'
  }
})
