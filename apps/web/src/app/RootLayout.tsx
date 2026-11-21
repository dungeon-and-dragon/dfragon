import { ClientOnly, Outlet } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useState } from 'react'
import {
  ClientHostContext,
  ScreenCaptureProvider,
  useBrowserHost,
  useScreenCaptureContext,
  WEB_CAPTURE_TEXTS
} from '#features/capture-search'
import { PageNoteTarget } from '#shared/ui/page-note-target'
import { GlobalBar } from '#widgets/global-bar'
import { SiteFooter } from '#widgets/site-footer'

// 다른 화면을 보는 동안 공유가 끝나도 연결 상태가 남지 않도록 화면 공유 칩 대신 화면들 위에서 구독한다.
function ScreenShareEndings(): null {
  const host = useBrowserHost()
  const { selectSource } = useScreenCaptureContext().partyCapture.source
  const onShareEnded = useEffectEvent(() => selectSource(''))

  useEffect(() => host.onScreenShareEnded(onShareEnded), [host])

  return null
}

function SiteLayout(): React.JSX.Element {
  return (
    <div className="flex grow flex-col overflow-x-clip font-sans text-fg">
      <GlobalBar />
      {/* 900px 미만에서는 페이지 대신 화면 상자 안에서 가로로 스크롤한다. 안의 보조 기술용 absolute 요소가 상자 밖 페이지를
          기준으로 놓이면 overflow에 잘리지 않고 페이지를 넓히므로 상자를 기준으로 삼는다. 넓은 창에서는 구획의 가로 선이
          상자 밖 창 끝까지 그어져야 하므로 상자에 스크롤을 두지 않는다. */}
      <div className="page screen bg-canvas">
        <main className="relative flex flex-col max-md:overflow-x-auto">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}

// 화면을 옮겨도 화면 공유 연결과 표 상태가 남도록 캡처 provider를 화면들 위에 둔다.
function CaptureSite(): React.JSX.Element {
  const host = useBrowserHost()

  return (
    <ClientHostContext value={host}>
      <ScreenCaptureProvider texts={WEB_CAPTURE_TEXTS}>
        <ScreenShareEndings />
        <SiteLayout />
      </ScreenCaptureProvider>
    </ClientHostContext>
  )
}

export function RootLayout(): React.JSX.Element {
  const [noteTarget, setNoteTarget] = useState<HTMLElement | null>(null)

  // 푸터를 페이지 아래에 두므로 화면이 짧아도 창 높이를 채우고, 내용이 길면 푸터가 내용 아래로 밀린다.

  return (
    <div className="relative box-border flex min-h-dvh flex-col pb-4">
      <PageNoteTarget value={noteTarget}>
        {/* 화면은 브라우저 host가 있어야 그릴 수 있어, 서버가 만드는 HTML에는 빈 전역 바만 둔다. */}
        <ClientOnly fallback={<div className="h-topbar shrink-0 border-b border-line bg-canvas" />}>
          <CaptureSite />
        </ClientOnly>
      </PageNoteTarget>
      <div ref={setNoteTarget} className="absolute bottom-8 left-4 text-2xs text-fg-subtle" />
      <span className="absolute bottom-4 left-4 num text-2xs text-fg-subtle">
        <span className="sr-only">빌드 </span>
        {__BUILD_COMMIT__}
      </span>
    </div>
  )
}
