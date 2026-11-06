import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const ICON_SIZE = 28

// 테두리와 배지처럼 그라데이션을 쓸 수 없는 좁은 자리의 단색이다.
export const raritySolid = stylex.create({
  common: { color: colors.rarityCommon },
  uncommon: { color: colors.rarityUncommon },
  rare: { color: colors.rarityRare },
  unique: { color: colors.rarityUnique },
  legendary: { color: colors.rarityLegendary },
  epic: { color: colors.rarityEpic },
  chronicle: { color: colors.rarityChronicle },
  primordial: { color: colors.rarityPrimordial },
  mythic: { color: colors.rarityMythic },
  unknown: { color: colors.borderStrong }
})

export const styles = stylex.create({
  icon: {
    display: 'block',
    flexShrink: 0,
    boxSizing: 'border-box',
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset,
    objectFit: 'contain'
  },
  iconSpace: { flexShrink: 0, width: ICON_SIZE, height: ICON_SIZE },
  name: { fontWeight: 600 },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    height: 18,
    paddingInline: 5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  item: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  itemText: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, minWidth: 0 },
  tune: { color: colors.fgMuted, fontSize: 12, fontWeight: 600 },
  strip: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 6,
    minHeight: 36,
    boxSizing: 'border-box',
    paddingBlock: space.s8,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  stripLabel: { color: colors.fgSubtle, fontSize: 12 },
  stripMuted: { color: colors.fgMuted, fontVariantNumeric: 'tabular-nums' },
  spacer: { flexGrow: 1 }
})
