import { createContext } from 'react'

// 페이지 왼쪽 아래 빌드 표시 바로 위 슬롯 요소다. 앱 틀이 callback ref로 받은 요소를 넘긴다.
export const PageNoteTarget = createContext<HTMLElement | null>(null)
