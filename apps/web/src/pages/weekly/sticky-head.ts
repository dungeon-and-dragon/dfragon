import type { CSSProperties } from 'react'

// 가로 스크롤 틀(overflow-x: auto)은 세로 sticky의 기준을 가로채므로, 붙는 헤더가 있는 표는 sm 이상에서 틀 없이 창 기준으로 붙인다.
export const STICKY_TABLE_FRAME = 'max-sm:overflow-x-auto'

export const STICKY_HEAD = 'bg-canvas sm:sticky sm:top-(--sticky-head-top,0px) sm:z-raised'

// border-collapse 표에서는 sticky 헤더의 border가 따라 움직이지 않아 아래 선을 shadow로 그린다.
export const STICKY_HEAD_CELL = 'sm:border-b-0 sm:shadow-[inset_0_-1px_0_var(--color-line)]'

// table-wide 표는 최소 720px이라, 그보다 좁은 창에서는 가로 스크롤을 남기고 표가 다 들어가는 768px부터 헤더를 붙인다.
export const WIDE_STICKY_TABLE_FRAME = 'max-[768px]:overflow-x-auto'

export const WIDE_STICKY_HEAD =
  'bg-canvas min-[768px]:sticky min-[768px]:top-(--adventure-tabs-height,0px) min-[768px]:z-raised'

export const WIDE_STICKY_HEAD_CELL =
  'min-[768px]:border-b-0 min-[768px]:shadow-[inset_0_-1px_0_var(--color-line)]'

export function adventureTabsHeight(height: number): CSSProperties {
  return { '--adventure-tabs-height': `${height}px` } as CSSProperties
}
