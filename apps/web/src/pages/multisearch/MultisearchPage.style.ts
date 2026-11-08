import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  page: { display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: space.s16 },
  pageWidth: (screenWidth: number) => ({ minWidth: screenWidth }),
  box: {
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  }
})
