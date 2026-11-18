export const itemClasses = {
  icon: 'box-border block size-game-icon shrink-0 rounded-badge border border-current bg-inset object-contain',
  iconSpace: 'size-game-icon shrink-0',
  name: 'font-semibold',
  item: 'flex min-w-0 items-center gap-3',
  itemText: 'flex min-w-0 flex-wrap items-center gap-2',
  strip:
    'box-border flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2',
  stripMuted: 'text-fg-muted',
  stripNumber: 'num text-fg-muted',
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
