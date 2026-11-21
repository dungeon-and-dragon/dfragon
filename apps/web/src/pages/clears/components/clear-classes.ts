export const clearClasses = {
  screen: 'flex flex-col',
  state: 'section state state-error',
  // 주, 단계, 컨텐츠를 바꿔 집계를 다시 받는 동안 문서가 짧아져 스크롤이 위로 밀리지 않게 화면 높이만큼 자리를 둔다.
  pending: 'min-h-dvh',
  empty: 'section state',
  // 패널이 모두 빠진 줄은 구획 선만 남기지 않게 숨긴다.
  row: 'section section-cols flex items-stretch empty:hidden max-sm:flex-col',
  bodyState: 'state state-error',
  subLabel: 'm-0 label'
} as const
