import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    boxSizing: 'border-box',
    padding: 16,
    paddingBottom: 48
  },
  app: {
    maxWidth: '100%',
    overflowX: 'auto',
    backgroundColor: '#0F0F11'
  },
  appPending: { width: 1280, height: 163 },
  neople: {
    position: 'fixed',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    outline: { default: null, ':focus-visible': '3px solid #0F1A24' },
    outlineOffset: 2
  },
  neopleLogo: { display: 'block' }
})
