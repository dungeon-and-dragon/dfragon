export const clearClasses = {
  screen: 'flex flex-col gap-4 p-4',
  state: 'm-0 text-sm text-fg-danger',
  // 주, 단계, 컨텐츠를 바꿔 집계를 다시 받는 동안 문서가 짧아져 스크롤이 위로 밀리지 않게 화면 높이만큼 자리를 둔다.
  pending: 'min-h-screen',
  empty:
    'm-0 rounded-panel border border-line bg-canvas px-4 py-12 text-center text-sm font-semibold',
  // 패널이 모두 빠진 줄은 화면 간격만 남기지 않게 숨긴다.
  row: 'flex items-stretch gap-4 empty:hidden max-sm:flex-col',
  bodyState: 'm-0 p-4 text-sm text-fg-danger',
  subLabel: 'm-0 text-xs font-medium text-fg-subtle'
} as const
