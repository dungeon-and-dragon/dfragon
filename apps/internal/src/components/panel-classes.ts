// field-box의 :focus-within 테두리가 focus를 보이므로 브라우저 outline은 끈다.
export const FIELD_INPUT = 'field-box box-border w-full font-sans outline-none'

export const panelClasses = {
  box: 'section min-w-0',
  empty: 'm-0 px-4 py-12 text-center text-sm font-semibold',
  scroll: 'overflow-x-auto'
} as const

const HEAD_CELL =
  'h-[36px] whitespace-nowrap border-b border-line bg-surface px-3 text-xs font-medium text-fg-subtle first:pl-4 last:pr-4'
const CELL =
  'h-row whitespace-nowrap border-b border-line px-3 py-2 align-middle first:pl-4 last:pr-4'

export const tableClasses = {
  table: 'w-full border-collapse',
  body: '[&>tr:last-child>td]:border-b-0',
  headCell: `${HEAD_CELL} text-left`,
  headCellEnd: `${HEAD_CELL} text-right`,
  row: 'transition-colors hover:bg-surface',
  selectedRow: 'bg-surface',
  cell: CELL,
  cellEnd: `${CELL} text-right`
} as const

export const textClasses = {
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  numeric: 'font-mono tabular-nums',
  twoLine: 'flex flex-col',
  small: 'text-xs text-fg-subtle',
  error: 'm-0 text-sm text-fg-danger',
  inline: 'inline-flex items-center gap-2'
} as const

export const popoverClasses = {
  positioner: 'popover-positioner',
  popup: 'popover flex flex-col whitespace-normal text-left font-sans text-sm',
  title: 'popover-title px-3 pt-3',
  actions: 'flex justify-end gap-2 px-3 pb-3'
} as const
