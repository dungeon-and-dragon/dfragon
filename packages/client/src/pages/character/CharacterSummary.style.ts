import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const PORTRAIT_WIDTH = 96
const PORTRAIT_HEIGHT = 112

export const styles = stylex.create({
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    padding: space.s16,
    backgroundColor: colors.bgBar,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  well: {
    position: 'relative',
    flexShrink: 0,
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_HEIGHT,
    overflow: 'hidden',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexGrow: 1,
    minWidth: 0
  },
  heading: { display: 'flex', alignItems: 'center', gap: space.s8, minWidth: 0 },
  name: { margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 700 },
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    fontSize: 13,
    lineHeight: '18px',
    whiteSpace: 'nowrap'
  },
  server: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInline: 6,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 500
  },
  muted: { color: colors.fgMuted },
  adventure: { color: colors.fgAdventure },
  guild: { color: colors.fgGuild },
  link: { textDecoration: { default: 'none', ':hover': 'underline' } },
  level: { color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums' },
  affiliation: { display: 'inline-flex', alignItems: 'center', gap: space.s8 },
  divider: { width: 1, height: 10, backgroundColor: colors.borderDefault },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 104
  },
  statLabel: { fontSize: 11, lineHeight: '14px', fontWeight: 500, color: colors.fgSubtle },
  statValue: {
    fontSize: 20,
    lineHeight: '24px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  },
  fame: { color: colors.gameFame },
  dealer: { color: colors.scoreDealer },
  buffer: { color: colors.scoreBuffer },
  missing: { color: colors.fgDisabled },
  approximate: {
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: colors.fgSubtle
  },
  bone: { display: 'block', borderRadius: radius.control, backgroundColor: colors.bgInset },
  boneSize: (width: number, height: number) => ({ width, height })
})
