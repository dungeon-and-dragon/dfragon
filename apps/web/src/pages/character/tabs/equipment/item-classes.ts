const STRIP_LAYOUT = 'box-border flex flex-wrap items-center gap-x-3 gap-y-2 px-4'

export const itemClasses = {
  iconSpace: 'size-game-icon shrink-0',
  item: 'flex min-w-0 items-center gap-3',
  itemText: 'flex min-w-0 flex-wrap items-center gap-2',
  strip: `${STRIP_LAYOUT} min-h-12 border-b border-line py-2`,
  stripGroup: 'border-b border-line py-2',
  stripRow: `${STRIP_LAYOUT} min-h-8`,
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
