// 600px 미만에서는 세트, 서약, 버프 스킬 줄의 글자를 12px, 보통 굵기로 맞추고 줄 사이를 좁힌다.
const STRIP_LAYOUT =
  'box-border flex flex-wrap items-center gap-x-3 gap-y-2 px-4 max-sm:gap-y-1 max-sm:text-xs max-sm:[&_*]:text-xs max-sm:[&_*]:font-normal'

export const itemClasses = {
  iconSpace: 'size-game-icon shrink-0',
  item: 'flex min-w-0 items-center gap-3',
  itemText: 'flex min-w-0 flex-wrap items-center gap-2',
  strip: `${STRIP_LAYOUT} min-h-12 border-b border-line py-2`,
  // 600px 미만에서는 장비 줄을 풀어 안개 융화를 서약 줄 아래 오른쪽에 둔다.
  stripGroup: 'border-b border-line py-2 max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:px-4',
  stripRow: `${STRIP_LAYOUT} min-h-8 max-sm:min-h-0`,
  stripMuted: 'text-fg-muted',
  stripNumber: 'num text-fg-muted',
  stripBonus: 'text-xs text-fg-subtle',
  spacer: 'grow'
} as const

export const itemTableClasses = {
  root: 'text-sm',
  slot: 'text-xs whitespace-nowrap text-fg-subtle',
  muted: 'text-fg-muted',
  missing: 'text-fg-subtle',
  heading: 'section-title',
  count: 'section-title-count'
} as const
