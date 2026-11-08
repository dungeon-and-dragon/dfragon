import * as stylex from '@stylexjs/stylex'
import { colors, size } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 푸터를 페이지 아래에 두므로 화면이 짧아도 창 높이를 채우고, 내용이 길면 푸터가 내용 아래로 밀린다.
  page: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    boxSizing: 'border-box',
    paddingBottom: 16
  },
  // 웹 앱을 받는 동안 전역 바 높이와 테두리만 비워 둔다.
  appPending: {
    flexShrink: 0,
    height: size.topbar,
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgSubtle
  },
  neople: {
    display: 'block',
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2
  },
  neopleLogo: { display: 'block' },
  divider: {
    flexShrink: 0,
    width: 1,
    height: 12,
    backgroundColor: colors.borderDefault
  },
  footerItem: { paddingBlock: 4, paddingInline: 2 },
  buildCommit: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    fontSize: 11,
    lineHeight: '14px',
    fontVariantNumeric: 'tabular-nums',
    color: colors.fgSubtle
  }
})
