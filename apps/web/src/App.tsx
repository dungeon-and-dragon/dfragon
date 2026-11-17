import { lazy, Suspense } from 'react'

// 웹 앱은 Base UI와 카드 묶음이 커서 빈 전역 바를 먼저 그린 뒤 받는다.
const WebClient = lazy(() => import('./WebClient'))

export default function App(): React.JSX.Element {
  // 푸터를 페이지 아래에 두므로 화면이 짧아도 창 높이를 채우고, 내용이 길면 푸터가 내용 아래로 밀린다.
  return (
    <div className="relative box-border flex min-h-screen flex-col pb-4">
      <Suspense fallback={<div className="h-topbar shrink-0 border-b border-line bg-canvas" />}>
        <WebClient />
      </Suspense>
      <span className="absolute bottom-4 left-4 font-mono text-2xs tabular-nums text-fg-subtle">
        <span className="sr-only">빌드 </span>
        {__BUILD_COMMIT__}
      </span>
    </div>
  )
}
