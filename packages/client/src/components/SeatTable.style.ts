import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 열 폭을 내용과 관계없이 지키도록 고정 배치로 두고, 넘치는 글자는 칸 안에서 말줄임한다.
  table: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: 13,
    lineHeight: '18px'
  },
  width: (width: number) => ({ width }),
  header: {
    height: 32,
    paddingBlock: 0,
    paddingInline: 10,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap'
  },
  first: { paddingInlineStart: 16 },
  end: { textAlign: 'right' },
  last: { paddingInlineEnd: 16 }
})
