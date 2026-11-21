import type { ReactNode } from 'react'

// 구획의 가로 선이 창 폭으로 그어지므로 웹 화면 뼈대처럼 바깥 상자가 가로로 자르고, 900px 미만에서는 화면 상자 안쪽이 가로로 스크롤한다.
export function StoryScreen({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-x-clip">
      <div className="page screen bg-canvas">
        <div className="relative flex flex-col max-md:overflow-x-auto">{children}</div>
      </div>
    </div>
  )
}
