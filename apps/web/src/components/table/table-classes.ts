export const tableClasses = {
  scroll: 'overflow-x-auto',
  table: 'w-full table-fixed border-collapse',
  wideTable: 'min-w-[720px]',
  body: '[&>tr:last-child>td]:border-b-0',
  row: 'hover:bg-surface',
  headCell:
    'h-[36px] border-b border-line bg-surface px-3 text-xs font-medium text-fg-subtle first:pl-4 last:pr-4',
  cell: 'h-row border-b border-line px-3 text-sm first:pl-4 last:pr-4',
  fame: 'text-right font-mono font-semibold tabular-nums text-game-fame',
  rankColumn: 'w-16',
  fameColumn: 'w-[120px]'
} as const
