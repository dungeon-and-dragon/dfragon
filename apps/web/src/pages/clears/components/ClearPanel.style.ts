import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'
import { breakpoints } from '../../../styles/breakpoints.stylex'

const PANEL_HEAD_HEIGHT = 40
const WHEEL_GAP = 24

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  state: { margin: 0, fontSize: 13, lineHeight: '18px', color: colors.fgDanger },
  // 주, 단계, 컨텐츠를 바꿔 집계를 다시 받는 동안 문서가 짧아져 스크롤이 위로 밀리지 않게 화면 높이만큼 자리를 둔다.
  pending: { minHeight: '100vh' },
  fame: { color: colors.gameFame },
  title: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s16,
    minHeight: 64,
    boxSizing: 'border-box',
    padding: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  },
  titleText: {
    margin: 0,
    marginRight: WHEEL_GAP,
    fontSize: 20,
    lineHeight: '28px',
    fontWeight: 700
  },
  titleStats: { display: 'flex', gap: space.s24, marginLeft: 'auto' },
  empty: {
    margin: 0,
    paddingBlock: 48,
    paddingInline: space.s16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  // 패널이 모두 빠진 줄은 화면 간격만 남기지 않게 숨긴다.
  row: {
    display: { default: 'flex', ':empty': 'none' },
    flexDirection: { default: 'row', [breakpoints.screenNarrow]: 'column' },
    alignItems: 'stretch',
    gap: space.s16
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  panelGrow: (grow: number) => ({ flexGrow: grow }),
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    height: PANEL_HEAD_HEIGHT,
    margin: 0,
    paddingInline: space.s16,
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  panelTitle: {
    flexGrow: 1,
    margin: 0,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700
  },
  panelBody: { display: 'flex', flexDirection: 'column', flexGrow: 1 },
  bodyState: { margin: 0, padding: space.s16, fontSize: 13, color: colors.fgDanger },
  subLabel: {
    margin: 0,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgSubtle
  },
  columnsBlock: { position: 'relative', display: 'flex', flexDirection: 'column', flexGrow: 1 },
  columnsLabel: { position: 'absolute', top: space.s16, left: space.s16 }
})
