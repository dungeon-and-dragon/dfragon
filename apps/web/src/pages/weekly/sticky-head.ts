import type { CSSProperties } from 'react'

// 가로 스크롤 틀(overflow-x: auto)은 세로 sticky의 기준을 가로채므로, 붙는 헤더가 있는 표는 틀 없이 창 기준으로 붙인다.
// 900px 미만에서는 화면 상자 자체가 가로 스크롤 틀이라 창 기준으로 붙지 못하므로 md부터 붙인다.
// 틀이 relative여야 표 안의 보조 기술용 absolute 요소가 틀에 잘려 화면 상자의 가로 스크롤 범위를 넓히지 않는다.
export const STICKY_TABLE_FRAME = 'max-md:relative max-md:overflow-x-auto'

export const STICKY_HEAD = 'bg-canvas md:sticky md:top-(--sticky-head-top,0px) md:z-raised'

// border-collapse 표에서는 sticky 헤더의 border가 따라 움직이지 않아 아래 선을 shadow로 그린다.
export const STICKY_HEAD_CELL = 'md:border-b-0 md:shadow-[inset_0_-1px_0_var(--color-line)]'

export const WIDE_STICKY_TABLE_FRAME = 'max-md:relative max-md:overflow-x-auto'

export const WIDE_STICKY_HEAD =
  'bg-canvas md:sticky md:top-(--adventure-tabs-height,0px) md:z-raised'

export const WIDE_STICKY_HEAD_CELL = 'md:border-b-0 md:shadow-[inset_0_-1px_0_var(--color-line)]'

export function adventureTabsHeight(height: number): CSSProperties {
  return { '--adventure-tabs-height': `${height}px` } as CSSProperties
}
