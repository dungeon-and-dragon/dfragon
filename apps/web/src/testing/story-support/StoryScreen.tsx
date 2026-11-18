import type { ReactNode } from 'react'

// 구획의 가로 선이 창 폭으로 그어지므로 웹 화면 뼈대처럼 바깥 상자가 가로로 자른다.
export function StoryScreen({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-x-clip">
      <div className="page screen bg-canvas">{children}</div>
    </div>
  )
}
