import { lazy, Suspense, useState } from 'react'
import { PageNoteTarget } from '#shared/ui/page-note-target'

// 웹 앱은 Base UI와 카드 묶음이 커서 빈 전역 바를 먼저 그린 뒤 받는다.
const WebClient = lazy(() => import('./WebClient'))

export default function App(): React.JSX.Element {
  const [noteTarget, setNoteTarget] = useState<HTMLElement | null>(null)

  // 푸터를 페이지 아래에 두므로 화면이 짧아도 창 높이를 채우고, 내용이 길면 푸터가 내용 아래로 밀린다.

  return (
    <div className="relative box-border flex min-h-dvh flex-col pb-4">
      <PageNoteTarget value={noteTarget}>
        <Suspense fallback={<div className="h-topbar shrink-0 border-b border-line bg-canvas" />}>
          <WebClient />
        </Suspense>
      </PageNoteTarget>
      <div ref={setNoteTarget} className="absolute bottom-8 left-4 text-2xs text-fg-subtle" />
      <span className="absolute bottom-4 left-4 num text-2xs text-fg-subtle">
        <span className="sr-only">빌드 </span>
        {__BUILD_COMMIT__}
      </span>
    </div>
  )
}
