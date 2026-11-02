import type { ClipboardApi } from '@dfragon/client-core/preload/common/types/clipboard'
import type { DesktopShortcutApi } from '@dfragon/client-core/preload/common/types/desktop-shortcut'
import type { DiagnosticApi } from '@dfragon/client-core/preload/common/types/diagnostics'
import type { AsyncIPCFunctions } from '@dfragon/client-core/preload/common/types/ipc'
import type { SearchApi } from '@dfragon/client-core/preload/common/types/search'
import type { TodayGradeApi } from '@dfragon/client-core/preload/common/types/today-grade'
import type { UpdateNoticeApi } from '@dfragon/client-core/preload/common/types/update-notice'
import type { WindowChromeApi } from '@dfragon/client-core/preload/common/types/window-chrome'

// Desktop preload가 붙이던 bridge 9개다. 웹에서는 site/web/browser-host.ts가 같은 모양으로 채운다.
declare global {
  interface Window {
    api: Pick<
      AsyncIPCFunctions,
      | 'readCaptureFrame'
      | 'listCaptureSources'
      | 'selectCaptureSource'
      | 'notifyOcrCandidatesDetected'
    >
    search: SearchApi
    raidSearch: SearchApi & {
      notifyOcrCandidatesDetected: AsyncIPCFunctions['notifyRaidOcrCandidatesDetected']
      readCaptureFrame: AsyncIPCFunctions['readRaidCaptureFrame']
    }
    desktopShortcut: DesktopShortcutApi
    diagnostics: DiagnosticApi
    updateNotice: UpdateNoticeApi
    todayGrade: TodayGradeApi
    windowChrome: WindowChromeApi
    desktopClipboard: ClipboardApi
  }
}
